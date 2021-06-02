const AWS = require('aws-sdk');
const mongoose = require('mongoose');
const Picture = require('./models/pictureModel.js');

const rekognition = new AWS.Rekognition({ region: process.env.AWS_REGION });
//const collectionName = 'my-rekognition-collection';

const listCollections = async () => {
  return new Promise((resolve, reject) => {
    rekognition.listCollections((err, collections) => {
      if (err) {
        return reject(err);
      }

      return resolve(collections);
    });
  });
};

const createCollection = async (collectionName) => {
  return new Promise((resolve, reject) => {
    rekognition.createCollection(
      { CollectionId: collectionName },
      (err, data) => {
        if (err) {
          return reject(err);
        }

        return resolve(data);
      }
    );
  });
};

exports.initialise = async (collectionName) => {
  AWS.config.region = process.env.AWS_REGION;

  const collections = await listCollections();
  const hasCollections =
    collections &&
    collections.CollectionIds &&
    collections.CollectionIds.length;
  const collectionIds = hasCollections ? collections.CollectionIds : [];
  const hasCollection = collectionIds.find((c) => c === collectionName);

  if (!hasCollection) {
    await createCollection(collectionName);
  }
};

exports.addImageToCollection = async (
  bucket,
  pictureId,
  s3Filename,
  collectionName
) => {
  return new Promise((resolve, reject) => {
    rekognition.indexFaces(
      {
        CollectionId: collectionName,
        ExternalImageId: pictureId,
        Image: {
          S3Object: {
            Bucket: bucket,
            Name: s3Filename,
          },
        },
      },
      (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      }
    );
  });
};

exports.recogniseFromBuffer = async (image, collectionName) => {
  return new Promise((resolve, reject) => {
    rekognition.searchFacesByImage(
      {
        CollectionId: collectionName,
        FaceMatchThreshold: 95,
        Image: { Bytes: image },
        MaxFaces: 5,
      },
      async (err, data) => {
        if (err) {
          return reject(err);
        }

        if (
          data.FaceMatches &&
          data.FaceMatches.length > 0 &&
          data.FaceMatches[0].Face
        ) {
          const sorted = data.FaceMatches.sort(
            (a, b) => b.Face.Confidence - a.Face.Confidence
          );

          const matchSet = new Set();
          sorted.forEach((match) => {
            matchSet.add(
              mongoose.Types.ObjectId(match.Face.ExternalImageId.toString())
            );
          });

          const pictures = Picture.getPictures(
            Array.from(matchSet).map((el) => mongoose.Types.ObjectId(el))
          );

          return resolve(pictures);
        }
        return reject('Not recognized');
      }
    );
  });
};
