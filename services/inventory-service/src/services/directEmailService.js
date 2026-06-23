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

/**
 * Obtiene los correos de todos los administradores desde users-service.
 * La URL se configura via USERS_SERVICE_URL (default: http://users-service:3001).
 */
async function getAdminEmails() {
    const baseUrl = process.env.USERS_SERVICE_URL || 'http://users-service:3001';
    try {
        const res = await fetch(`${baseUrl}/api/auth/users/admins`, {
            signal: AbortSignal.timeout(5000),
            headers: {
                'x-internal-secret': process.env.INTERNAL_SECRET || 'kiora_internal_2024'
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.emails || [];
    } catch (err) {
        logger.warn('No se pudieron obtener correos de administradores', { error: err.message });
        return [];
    }
}

async function sendLowStockEmail(productData, toOverride = null) {
    if (!transporter) initTransporter();
    if (!transporter) return;

    // Obtener destinatarios: admins del sistema o fallback a variable de entorno
    let recipients = toOverride ? [toOverride] : await getAdminEmails();
    if (recipients.length === 0) {
        recipients = [process.env.ALERT_EMAIL || process.env.SMTP_USER].filter(Boolean);
    }
    if (recipients.length === 0) return;

    const subject = `⚠️ ALERTA DE STOCK: ${productData.nom_prod || 'Producto ID: ' + productData.cod_prod}`;
    
    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f0eb; padding: 40px 20px; color: #333333;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(61,26,16,0.12);">
                <div style="background-color: #3D1A10; padding: 28px 30px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 900; margin: 0; letter-spacing: 1px;">KIORA INVENTORY SYSTEM</h1>
                </div>
                <div style="height: 4px; background: linear-gradient(to right, #C41E1E, #3D1A10);"></div>
                <div style="padding: 40px 36px;">
                    <h2 style="color: #3D1A10; font-size: 22px; margin-top: 0; margin-bottom: 16px;">Aviso de Reposición Urgente</h2>
                    <p style="font-size: 15px; line-height: 1.6; color: #555555; margin-top: 0;">
                        Hola,<br><br>
                        El sistema de monitoreo automático ha detectado que un producto ha alcanzado o superado su límite de seguridad de stock.
                    </p>
                    <div style="background-color: #fdf5f0; border-radius: 8px; border: 2px dashed #C41E1E; padding: 24px; margin: 24px 0;">
                        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #3D1A10; font-weight: bold; text-transform: uppercase;">Producto:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 900;">${productData.nom_prod || productData.cod_prod}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #3D1A10; font-weight: bold; text-transform: uppercase;">Stock Actual:</td>
                                <td style="padding: 8px 0; text-align: right; color: #C41E1E; font-weight: 900; font-size: 18px;">${productData.stock_actual} unidades</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #3D1A10; font-weight: bold; text-transform: uppercase;">Mínimo Requerido:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 500;">${productData.stock_minimo || 'No definido'} unidades</td>
                            </tr>
                        </table>
                    </div>
                    <p style="font-size: 14px; line-height: 1.5; color: #777777; font-style: italic; text-align: center;">
                        Por favor, ingresa al panel administrativo para gestionar el reabastecimiento de este ítem.
                    </p>
                    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
                    <p style="font-size: 12px; line-height: 1.5; color: #999999; margin-bottom: 0; text-align: center;">
                        Este es un correo automático. Por favor no respondas a este mensaje.
                    </p>
                </div>
                <div style="background-color: #3D1A10; padding: 14px 30px; text-align: center;">
                    <p style="color: #c8a898; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Kiora. Todos los derechos reservados.</p>
                </div>
            </div>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Kiora Admin" <${process.env.SMTP_USER}>`,
            to: recipients.join(', '),
            subject,
            html
        });
        logger.info('Email de alerta enviado DIRECTAMENTE desde inventory-service', { to: recipients });
    } catch (error) {
        logger.error('Error al enviar email directo desde inventory-service', { error: error.message });
    }
}

module.exports = { sendLowStockEmail };
