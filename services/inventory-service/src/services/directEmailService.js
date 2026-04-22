'use strict';

const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporter = null;

function initTransporter() {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn('SMTP no configurado en inventory-service. Las alertas de Gmail no funcionarán.');
        return;
    }

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    logger.info('Motor de correo directo inicializado en inventory-service');
}

async function sendLowStockEmail(productData, toOverride = null) {
    if (!transporter) initTransporter();
    if (!transporter) return;

    const to = toOverride || process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    const subject = `⚠️ ALERTA DE STOCK: ${productData.nom_prod || 'Producto ID: ' + productData.cod_prod}`;
    
    const html = `
        <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #ec131e;">Alerta de Inventario Kiora</h2>
            <p>Se ha detectado un producto por debajo del nivel mínimo de seguridad:</p>
            <ul>
                <li><strong>Producto:</strong> ${productData.nom_prod || productData.cod_prod}</li>
                <li><strong>Stock Actual:</strong> <span style="color: red; font-weight: bold;">${productData.stock_actual}</span></li>
                <li><strong>Stock Mínimo:</strong> ${productData.stock_minimo || 'No definido'}</li>
            </ul>
            <p>Por favor, revisa el panel de administración para reabastecer.</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Kiora Admin" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html
        });
        logger.info('Email de alerta enviado DIRECTAMENTE desde inventory-service', { to });
    } catch (error) {
        logger.error('Error al enviar email directo desde inventory-service', { error: error.message });
    }
}

module.exports = { sendLowStockEmail };
