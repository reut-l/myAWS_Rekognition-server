const fs = require('fs');
const path = require('path');
const temp = require('temp');
const multer = require('multer');
const multerS3 = require('multer-s3-transform');
const { v4: uuidv4 } = require('uuid');
const aws = require('aws-sdk');
const Picture = require('../models/pictureModel');
const faceRecognition = require('../faceRecognition');

const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const setMetadata = (file) => ({ filename: file.originalname });
const setKey = (file) =>
  `${uuidv4()}${file.originalname.substring(
    file.originalname.lastIndexOf('.')
  )}`;

const upload = () =>
  multer({
    storage: multerS3({
      s3,
      bucket: process.env.AWS_BUCKET,
      acl: 'public-read',
      metadata: (_req, file, cb) => {
        cb(null, setMetadata(file));
      },
      key: (_req, file, cb) => {
        cb(null, setKey(file));
      },
    }),
  });

const getObjectBuf = async (imgId) => {
  try {
    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: imgId,
    };

    const data = await s3.getObject(params).promise();
    return data.Body;
  } catch (e) {
    throw new Error(`Could not retrieve file from S3: ${e.message}`);
  }
};

exports.getImage = async (req, res) => {
  try {
    const imgBuf = await getObjectBuf(req.params.imageId);

    temp.track();

    temp.open({ suffix: '.jpeg' }, (err, info) => {
      if (err) throw err;

      fs.write(info.fd, imgBuf, (err) => {
        if (err) throw err;
      });
      fs.close(info.fd, (err) => {
        if (err) throw err;

        res.download(info.path, 'photo.jpeg', (err) => {
          if (err) throw err;

          temp.cleanup();
        });
      });
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Server Error, Please try again later!',
    });
  }
};

exports.upload = upload().array('photos', 50);

exports.savePicture = async (req, res) => {
  try {
    await Promise.all(
      req.files.map(async (file) => {
        const originalFile = file;

        const { originalname, mimetype } = originalFile;

        const picture = {
          filename: originalname,
          mimeType: mimetype,
          bucket: originalFile.bucket,
          contentType: originalFile.contentType,
          location: originalFile.location,
          etag: originalFile.etag,
        };

        const result = await Picture.create(picture);

        const collectionName = `${req.params.id}-rekognition-collection`;

        await faceRecognition.initialise(collectionName);

        await faceRecognition.addImageToCollection(
          originalFile.bucket,
          result._id.toString(),
          originalFile.key,
          collectionName
        );

        return res.status(200).json({ success: true, data: 'Upload complete' });
      })
    );
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Server Error, Please try again later!',
    });
  }
};

exports.uploadSingle = multer().single('photo');

exports.recogniseMe = async (req, res) => {
  const collectionName = `${req.params.id}-rekognition-collection`;

  try {
    const result = await faceRecognition.recogniseFromBuffer(
      req.file.buffer,
      collectionName
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.code === 'ResourceNotFoundException')
      return res.status(200).json({
        success: true,
        message: 'Empty event',
      });

    return res.status(500).json({
      status: 'error',
      message: 'Server Error, Please try again later!',
    });
  }
};
