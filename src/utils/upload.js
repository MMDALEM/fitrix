const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const randomstring = require('randomstring');
const md5 = require('md5');
const mime = require('mime-types');


const s3 = new S3Client({
  endpoint: process.env.LIARA_ENDPOINT,
  credentials: {
    accessKeyId: process.env.LIARA_ACCESS_KEY,
    secretAccessKey: process.env.LIARA_SECRET_KEY,
  },
  region: 'default',
});

const upload_public = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.LIARA_BUCKET_NAME,
    key: function (req, file, cb) {
      const hashIdSalt = randomstring.generate(64);
      const hashIdString = `file-${hashIdSalt}-${Date.now()}`;
      const hashId = md5(hashIdString);


      const ext = mime.extension(file.mimetype);
      const fileName = hashId + '.' + ext;
      req.body.fileUploadPath = process.env.URL_RES
      req.body.filename = fileName
      req.body.hash = hashId

      cb(null, fileName);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
});

module.exports = { upload_public };