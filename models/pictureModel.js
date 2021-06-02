const mongoose = require('mongoose');

const pictureSchema = new mongoose.Schema({
  filename: String,
  mimeType: String,
  bucket: String,
  contentType: String,
  location: String,
  etag: String,
});

pictureSchema.statics.getPictures = async function (ids) {
  return await this.find({
    _id: {
      $in: ids,
    },
  });
};

const Picture = mongoose.model('Picture', pictureSchema);

module.exports = Picture;
