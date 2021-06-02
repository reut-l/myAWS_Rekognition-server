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

exports.upload = upload().single('filepond');

exports.savePicture = async (req, res) => {
  try {
    const originalFile = req.file;

    if (!originalFile) {
      throw new Error('Unable to find original file!');
    }

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
  } catch (e) {
    return res.status(500).json({
      success: false,
      data: e,
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
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: 'No faces were recognised',
    });
  }
};
