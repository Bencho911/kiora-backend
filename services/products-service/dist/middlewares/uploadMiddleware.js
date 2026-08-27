"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("../config/logger"));
const UPLOAD_DIR = path_1.default.join(__dirname, '..', 'public', 'uploads');
const isCloudinaryConfigured = () => {
    return !!(process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET);
};
let upload;
if (isCloudinaryConfigured()) {
    const cloudinary = require('../config/cloudinary').default;
    const { CloudinaryStorage } = require('multer-storage-cloudinary-v2');
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'kiora_products',
            allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
            transformation: [{ width: 800, crop: 'limit', quality: 'auto' }]
        }
    });
    upload = (0, multer_1.default)({
        storage: storage,
        limits: { fileSize: 5 * 1024 * 1024 }
    });
    logger_1.default.info('Cloudinary configurado para subida de imágenes');
}
else {
    logger_1.default.warn('Cloudinary no configurado — usando almacenamiento local en ' + UPLOAD_DIR);
    const diskStorage = multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
        filename: (_req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path_1.default.extname(file.originalname) || '.jpg';
            cb(null, uniqueSuffix + ext);
        },
    });
    upload = (0, multer_1.default)({
        storage: diskStorage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
            const ext = path_1.default.extname(file.originalname).toLowerCase();
            if (allowed.includes(ext)) {
                cb(null, true);
            }
            else {
                cb(new Error('Extension not allowed'));
            }
        },
    });
}
exports.default = upload;
