const nodemailer = require('nodemailer');
const path = require('path');

/**
 * emailService
 * Responsabilidad única: envío de correos electrónicos vía SMTP (Nodemailer).
 * El transporter se crea de forma lazy para no fallar al iniciar el servidor
 * si la configuración SMTP no está lista.
 */

const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@kiora.com';
const RESET_CODE_EXPIRY_MINUTES = 15;
const LOGO_PATH = path.join(__dirname, '../assets/kiora_logo.png');

const getTransporter = () => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('Configuración SMTP incompleta. Revisa SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS.');
    }
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

/**
 * Genera el HTML del correo OTP de recuperación.
 * Exportado para que el controller pueda enviarlo vía Redis pub/sub.
 * @param {string} code - Código OTP de 6 dígitos
 * @returns {string} HTML listo para enviar
 */
const buildResetCodeHtml = (code) => `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f0eb; padding: 40px 20px; color: #333333;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(61,26,16,0.12);">
            <div style="background-color: #3D1A10; padding: 28px 30px; text-align: center;">
                <img src="cid:kiora_logo" alt="Kiora" style="height: 52px; width: auto;" />
            </div>
            <div style="height: 4px; background: linear-gradient(to right, #C41E1E, #3D1A10);"></div>
            <div style="padding: 40px 36px;">
                <h2 style="color: #3D1A10; font-size: 22px; margin-top: 0; margin-bottom: 8px;">Recuperación de contraseña</h2>
                <p style="font-size: 15px; line-height: 1.6; color: #555555; margin-top: 0;">
                    Hola,<br><br>
                    Recibimos una solicitud para restablecer la contraseña de tu cuenta.
                    Usa el siguiente código de seguridad para continuar:
                </p>
                <div style="text-align: center; margin: 32px 0;">
                    <span style="display: inline-block; font-size: 34px; font-weight: bold; letter-spacing: 10px; color: #3D1A10; background-color: #fdf5f0; padding: 16px 32px; border-radius: 8px; border: 2px dashed #C41E1E;">
                        ${code}
                    </span>
                </div>
                <p style="font-size: 15px; line-height: 1.5; color: #555555; text-align: center;">
                    Este código expira en <strong style="color: #C41E1E;">${RESET_CODE_EXPIRY_MINUTES} minutos</strong>.
                </p>
                <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
                <p style="font-size: 13px; line-height: 1.5; color: #999999; margin-bottom: 0;">
                    Si no solicitaste este cambio, puedes ignorar este correo de forma segura.
                    Tu contraseña no cambiará hasta que ingreses el código y crees una nueva.
                </p>
            </div>
            <div style="background-color: #3D1A10; padding: 14px 30px; text-align: center;">
                <p style="color: #c8a898; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Kiora. Todos los derechos reservados.</p>
            </div>
        </div>
    </div>
`;

/**
 * Envía el correo con código OTP de recuperación (fallback directo).
 * @param {string} correo_usu - Dirección de email del destinatario
 * @param {string} code - Código OTP de 6 dígitos
 */
const sendPasswordResetCode = async (correo_usu, code) => {
    const transporter = getTransporter();

    await transporter.sendMail({
        from: FROM_EMAIL,
        to: correo_usu,
        subject: 'Código de recuperación - Kiora',
        text: `Tu código de recuperación es: ${code}. Expira en ${RESET_CODE_EXPIRY_MINUTES} minutos. Si no solicitaste este cambio, ignora este correo.`,
        html: buildResetCodeHtml(code),
        attachments: [
            {
                filename: 'kiora_logo.png',
                path: LOGO_PATH,
                cid: 'kiora_logo',
            },
        ],
    });
};
module.exports = { sendPasswordResetCode, buildResetCodeHtml, RESET_CODE_EXPIRY_MINUTES };
