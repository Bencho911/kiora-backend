'use strict';

const crypto = require('crypto');

const generateElectronicInvoice = async (req, res, next) => {
    try {
        const { id_vent } = req.params;

        // Simulamos obtener la venta desde orders-service (simplificado)
        const mockMonto = 15000;
        const mockFecha = new Date().toISOString();

        // Simular generación de CUFE (Código Único de Facturación Electrónica)
        const cufe = crypto.createHash('sha384').update(`KIORA-VENTA-${id_vent}-${mockFecha}-${Date.now()}`).digest('hex');
        
        const qrCodeData = `NumFac: ${id_vent}\nFecFac: ${mockFecha}\nNitFac: 900.123.456-7\nDocAdq: CONSUMIDOR FINAL\nValFac: ${mockMonto}\nValIva: ${(mockMonto * 0.19).toFixed(2)}\nCUFE: ${cufe}`;

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
                    subtotal: (mockMonto / 1.19).toFixed(2),
                    iva_19: (mockMonto - (mockMonto / 1.19)).toFixed(2),
                    total: Number(mockMonto).toFixed(2)
                },
                items: []
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
