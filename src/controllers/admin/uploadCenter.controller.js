require("dotenv").config();
const modelItem = require("../../models/uploadCenter.model");
const { sendSuccess, sendError } = require("../../utils/res");

exports.createLiara = async (req, res, next) => {
  const des = req.body.des || null;
  const file = req.file;

  const fileName = file.originalname;
  const fileSize = file.size;
  const fileNameBeforeSave = file.key;
  const ext = file.mimetype;
  const data = {
    fileName: fileNameBeforeSave,
    fileSize: fileSize,
    fileNameBeforeSave: fileName,
    fileNameExt: ext,
    des: des,
  };

  const item = new modelItem(data);

  try {
    await item.save();
    return sendSuccess(res, 200, d);
  } catch (err) {
    next(err);
  }
};

exports.findOne = async (req, res, next) => {
  try {
    const data = await modelItem.findOne({ _id: req.params.id });
    return res.status(200).json(sendSuccess(data));
  } catch (err) {
    next(err);
  }
};

exports.findMany = async (req, res, next) => {
  try {
    const fileNameExt = req.query.fileNameExt || "all";
    const page = req.query.page || 0;
    const limit = 10;
    const skip = page * limit;
    const sort = {
      updatedAt: -1,
    };

    let query = {};
    if (fileNameExt !== "all") {
      query = {
        fileNameExt: fileNameExt,
      };
    }

    //const fields = 'createdAt fileName fileNameBeforeSave fileNameExt fileSize';

    //let data = await modelItem.find(query, fields).skip(skip).limit(limit).sort(['updatedAt', -1]).exec();

    const fields = [
      "createdAt",
      "fileName",
      "fileNameBeforeSave",
      "fileNameExt",
      "fileSize",
      "des",
    ];

    const data = await modelItem.find(query, fields, {
      limit: limit,
      sort: sort,
    });

    return res.status(200).json(sendSuccess(data));
  } catch (err) {
    next(err);
  }
};

// exports.removePrivateFileLiara = async (req, res, next) => {
//   const teacher = await teacherModel.findOne({
//     hashIdAuth: req.systemUser.hashIdAuth,
//   });
//   if (!teacher)
//     return res.status(400).json(sendError("teacher not found"));

//   if (!req.body.docType)
//     return res.status(400).json(sendError("docType invalid"));

//   const document = await modelUploadCenterTeacher.findOne({
//     docType: req.body.docType,
//     teachId: teacher,
//   });
//   if (!document) {
//     return res.status(400).json(sendError("document not found"));
//   }

//   await modelUploadCenterTeacher.deleteOne({
//     docType: req.body.docType,
//     teachId: teacher,
//   });

//   const liaraRes = deleteFromPrivateLiara(
//     "teacher",
//     document.fileNameBeforeSave
//   );

//   if (liaraRes.httpStatusCode === 204) {
//     return res
//       .status(204)
// .json(sendError("document deleted successfully"));
//   }

//   return res.status(400).json(sendError("docType not deleted"));
// };
