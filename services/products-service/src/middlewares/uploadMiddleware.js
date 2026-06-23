const multer = require('multer');
const path = require('path');
const logger = require('../config/logger');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

const isCloudinaryConfigured = () => {
    return !!(process.env.CLOUDINARY_CLOUD_NAME &&
              process.env.CLOUDINARY_API_KEY &&
              process.env.CLOUDINARY_API_SECRET);
};

let upload;

if (isCloudinaryConfigured()) {
    const cloudinary = require('../config/cloudinary');
    const { CloudinaryStorage } = require('multer-storage-cloudinary-v2');

    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'kiora_products',
            allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
            transformation: [{ width: 800, crop: 'limit', quality: 'auto' }]
        }
    });

    upload = multer({
        storage: storage,
        limits: { fileSize: 5 * 1024 * 1024 }
    });

    logger.info('Cloudinary configurado para subida de imágenes');
} else {
    logger.warn('Cloudinary no configurado — usando almacenamiento local en ' + UPLOAD_DIR);

    const diskStorage = multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
        filename: (_req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname) || '.jpg';
            cb(null, uniqueSuffix + ext);
        },
    });

    upload = multer({
        storage: diskStorage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, allowed.includes(ext));
        },
    });
}

module.exports = upload;
