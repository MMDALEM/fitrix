const mongoose = require('mongoose');

const modelSchema = new mongoose.Schema(
  {
    title: {
      type: String,
    },
    fileName: {
      type: String,
    },
    nameDocument: {
      type: String,
    },
    des: {
      type: String,
    },
    type: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    fileNameBeforeSave: {
      type: String,
    },
    fileNameExt: {
      type: String,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Manager',
    },
    teachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    url: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UploadCenter', modelSchema);