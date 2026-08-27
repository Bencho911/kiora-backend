'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTransporter = initTransporter;
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_js_1 = __importDefault(require("../config/logger.js"));
let transporter = null;
/**
 * Inicializa el transporter de Nodemailer una sola vez.
 * Se llama al arrancar el servicio.
 */
function initTransporter(smtpConfig) {
    transporter = nodemailer_1.default.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
        },
    });
    logger_js_1.default.info('Transporter SMTP inicializado', {
        host: smtpConfig.host,
        port: smtpConfig.port,
    });
}
/**
 * Envía un email a partir de un evento de notificación.
 *
 * @param {{ to: string, subject: string, html: string, text?: string }} payload
 * @param {string} from - Dirección del remitente
 */
async function sendEmail(payload, from) {
    if (!transporter) {
        throw new Error('El transporter SMTP no ha sido inicializado');
    }
    const { to, subject, html, text } = payload;
    if (!to || !subject || !html) {
        throw new Error('Payload inválido: se requieren to, subject y html');
    }
    const info = await transporter.sendMail({ from, to, subject, html, text });
    logger_js_1.default.info('Email enviado', { to, subject, messageId: info.messageId });
    return info;
}
