'use strict';

const crypto = require('crypto');
const env = require('../config/env');

/**
 * electronicInvoiceController
 * Genera una simulación de factura electrónica para efectos de tirilla fiscal.
 */

const generateElectronicInvoice = async (req, res, next) => {
    try {
        const { id_vent } = req.params;

        // 1. Obtener la venta desde orders-service (simulado como una llamada interna real)
        const orderResponse = await fetch(`${env.ordersServiceUrl}/api/orders/${id_vent}`, {
            headers: {
                'x-correlation-id': req.headers['x-correlation-id'] || ''
            }
        });

        if (!orderResponse.ok) {
            const err = new Error('Venta no encontrada en orders-service');
            err.status = orderResponse.status === 404 ? 404 : 500;
            throw err;
        }

        const venta = await orderResponse.json();

        // 2. Simular generación de CUFE (Código Único de Facturación Electrónica)
        const cufe = crypto.createHash('sha384').update(`KIORA-VENTA-${id_vent}-${venta.fecha_vent}-${Date.now()}`).digest('hex');
        
        // 3. Simular validación con proveedor tecnológico / DIAN
        const qrCodeData = `NumFac: ${id_vent}\nFecFac: ${venta.fecha_vent}\nNitFac: 900.123.456-7\nDocAdq: CONSUMIDOR FINAL\nValFac: ${venta.montofinal_vent}\nValIva: ${(venta.montofinal_vent * 0.19).toFixed(2)}\nCUFE: ${cufe}`;

        // 4. Construir respuesta
        const invoiceData = {
            metadata: {
                proveedor_tecnologico: "Simulador Fiscal Kiora S.A.S.",
                ambiente: "PRUEBAS",
                fecha_validacion: new Date().toISOString()
            },
            factura: {
                numero: `FES-${id_vent.toString().padStart(6, '0')}`,
                cufe: cufe,
                qr_data: qrCodeData,
                emisor: {
                    razon_social: "Kiora MicroMarket S.A.S.",
                    nit: "900.123.456-7",
                    regimen: "Responsable de IVA"
                },
                adquirente: {
                    tipo: "Consumidor Final",
                    identificacion: "222222222222"
                },
                totales: {
                    subtotal: (venta.montofinal_vent / 1.19).toFixed(2),
                    iva_19: (venta.montofinal_vent - (venta.montofinal_vent / 1.19)).toFixed(2),
                    total: Number(venta.montofinal_vent).toFixed(2)
                },
                items: venta.items || []
            }
        };

        res.status(200).json(invoiceData);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    generateElectronicInvoice
};
