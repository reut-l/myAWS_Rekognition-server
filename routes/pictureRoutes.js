const express = require('express');
const pictureController = require('../controllers/pictureController');

const router = express.Router();

router.get('/image/:imageId', pictureController.getImage);

router.post(
  '/collections/:id/upload',
  pictureController.upload,
  pictureController.savePicture
);

router.post(
  '/collections/:id/face',
  pictureController.uploadSingle,
  pictureController.recogniseMe
);

module.exports = router;
