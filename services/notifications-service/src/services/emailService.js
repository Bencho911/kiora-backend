'use strict';

const nodemailer = require('nodemailer');
const logger     = require('../config/logger');

let transporter = null;

/**
 * Inicializa el transporter de Nodemailer una sola vez.
 * Se llama al arrancar el servicio.
 */
function initTransporter(smtpConfig) {
    transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
        },
    });

    logger.info('Transporter SMTP inicializado', {
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
    logger.info('Email enviado', { to, subject, messageId: info.messageId });
    return info;
}

module.exports = { initTransporter, sendEmail };
