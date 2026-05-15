const multer = require('multer');
const logger = require('../config/logger');

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
    logger.warn('Cloudinary no configurado — las imágenes se ignorarán');
    upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 }
    });
}

module.exports = upload;
