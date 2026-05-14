const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'public/uploads/products')
        // اگه پوشه نبود بسازش
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true })
        }
        cb(null, uploadPath)
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        const uniqueName = `product-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`
        cb(null, uniqueName)
    }
})

const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/
    const ext = allowed.test(path.extname(file.originalname).toLowerCase())
    const mime = allowed.test(file.mimetype)

    if (ext && mime) {
        cb(null, true)
    } else {
        cb(new Error('فقط فایل‌های تصویری مجاز هستند (jpg, png, webp)'))
    }
}

const upload_multer = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
})

module.exports = upload_multer