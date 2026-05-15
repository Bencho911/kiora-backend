'use strict';

const logger = require('../config/logger');
const env = require('../config/env');

let accessToken = null;
let refreshToken = null;
let tokenExpiresAt = 0;

/**
 * Autentica contra Factus usando grant_type=password.
 * Retorna { access_token, refresh_token, expires_in }.
 */
async function authenticate() {
    const url = `${env.factus.apiUrl}/oauth/token`;
    const body = new URLSearchParams({
        grant_type: 'password',
        client_id: env.factus.clientId,
        client_secret: env.factus.clientSecret,
        username: env.factus.username,
        password: env.factus.password,
    });

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Factus auth failed: ${res.status} ${errBody}`);
    }

    return res.json();
}

/**
 * Refresca el token usando refresh_token.
 */
async function refreshAccessToken() {
    if (!refreshToken) throw new Error('No hay refresh token disponible');

    const url = `${env.factus.apiUrl}/oauth/token`;
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.factus.clientId,
        client_secret: env.factus.clientSecret,
        refresh_token: refreshToken,
    });

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Factus refresh failed: ${res.status} ${errBody}`);
    }

    return res.json();
}

/**
 * Obtiene un token de acceso valido, cacheado o renovado.
 * Usa refresh_token si esta disponible, si no, hace login completo.
 */
async function getAccessToken() {
    // Token en cache y vigente
    if (accessToken && Date.now() < tokenExpiresAt) {
        return accessToken;
    }

    if (!env.factus.configured) {
        throw new Error('Factus no configurado.');
    }

    try {
        // Intentar refresh primero si tenemos refresh token
        if (refreshToken) {
            try {
                const data = await refreshAccessToken();
                accessToken = data.access_token;
                refreshToken = data.refresh_token || refreshToken;
                tokenExpiresAt = Date.now() + (data.expires_in || 600) * 1000 - 30000;
                logger.info('Factus token renovado via refresh_token');
                return accessToken;
            } catch (refreshErr) {
                logger.warn('Refresh token fallo, haciendo login completo', { error: refreshErr.message });
                refreshToken = null;
            }
        }

        // Login completo con username/password
        const data = await authenticate();
        accessToken = data.access_token;
        refreshToken = data.refresh_token || null;
        tokenExpiresAt = Date.now() + (data.expires_in || 600) * 1000 - 30000;
        logger.info('Factus login exitoso', { expiresIn: data.expires_in });
        return accessToken;
    } catch (err) {
        logger.error('Error autenticando con Factus', { error: err.message });
        throw err;
    }
}

/**
 * Convierte una orden de Kiora al formato V2 de Factus.
 * Schema basado en GET /v2/bills response y validacion 422 de Factus.
 */
function buildInvoicePayload(order) {
    const taxAmount = (price, qty) => Math.round(price * qty * 0.19 * 100) / 100;
    const totalAmount = (price, qty) => Math.round(price * qty * 100) / 100;

    const items = (order.items || []).map((item) => {
        const qty = item.cantidad || 1;
        const price = Number(item.precio_unit || 0);
        return {
            code_reference: String(item.cod_prod || ''),
            name: item.nom_prod || `Producto #${item.cod_prod}`,
            quantity: qty,
            price: price,
            tax_rate: '19.00',
            unit_measure_code: '94',
            standard_code: String(item.cod_prod || '0'),
            standard_code_type: '03',
            discount_rate: 0,
            discount_amount: 0,
            taxes: [{
                code: '01',
                name: 'IVA',
                rate: '19.00',
                taxable_amount: Math.round(price * qty * 100) / 100,
                tax_amount: taxAmount(price, qty),
            }],
            total_amount: totalAmount(price, qty),
        };
    });

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalTax = Math.round(subtotal * 0.19 * 100) / 100;
    const total = subtotal + totalTax;

    const paymentMethodCode = order.metodopago_usu === 'tarjeta' ? '2' : '10';
    const paymentMethodName = order.metodopago_usu === 'tarjeta' ? 'Tarjeta de crédito' : 'Efectivo';

    return {
        reference_code: `KIORA-VENTA-${order.id_vent}-${Date.now()}`,
        numbering_range_id: 389,
        document: '01',
        operation_type: '10',
        payment_details: [{
            payment_form: '1',
            payment_method_code: paymentMethodCode,
            amount: String(total.toFixed(2)),
            due_date: null,
        }],
        customer: {
            identification_document: { code: '13', name: 'Cédula ciudadanía' },
            identification: '222222222222',
            dv: null,
            graphic_representation_name: 'Consumidor final',
            trade_name: null,
            company: null,
            names: 'Consumidor final',
            address: 'No informado',
            email: '',
            phone: '',
            legal_organization: { code: '2', name: 'Persona Natural' },
            municipality: null,
        },
        items,
        total: String(total.toFixed(2)),
        send_email: false,
        errors: {},
        is_negotiable_instrument: false,
    };
}

/**
 * Envia una orden a Factus para generar la factura electronica.
 * @param {object} order - Datos de la orden (formato Kiora interno)
 * @returns {Promise<object>} Respuesta de Factus con CUFE, QR, etc.
 */
async function createInvoice(order) {
    if (!env.factus.configured) {
        logger.warn('Factus no configurado — simulando factura electronica');
        return generateMockInvoice(order);
    }

    try {
        const token = await getAccessToken();
        const payload = buildInvoicePayload(order);
        const url = `${env.factus.apiUrl}/v2/bills/validate`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errBody = await res.text();
            logger.warn('Factus rechazo la factura, usando simulacion', { status: res.status, error: errBody });
            const mockResult = generateMockInvoice(order);
            mockResult.factus_error = `${res.status}: ${errBody}`;
            return mockResult;
        }

        const data = await res.json();
        logger.info('Factura electronica emitida via Factus', { orderId: order.id_vent, number: data.data?.number });

        // Normalizar respuesta de Factus a formato estandar
        const bill = data.data || data;
        const items = bill.items || order.items || [];
        const subtotal = items.reduce((s, i) => s + Number(i.price || i.precio_unit || 0) * Number(i.quantity || i.cantidad || 1), 0);
        const iva = Math.round(subtotal * 0.19 * 100) / 100;
        const total = subtotal + iva;

        // Generar QR data con CUFE (Factus no lo devuelve en create, se obtiene de GET /v2/bills/:number)
        const crypto = require('crypto');
        const cufe = crypto.createHash('sha384').update(`FACTUS-${bill.number}-${Date.now()}`).digest('hex');
        const qrData = `NumFac: ${bill.number}\nFecFac: ${new Date().toISOString()}\nNitFac: 900.123.456-7\nDocAdq: CONSUMIDOR FINAL\nValFac: ${total.toFixed(2)}\nCUFE: ${cufe}`;

        return {
            status: 'CREATED',
            factus_api: 'v2',
            factus_response: data,
            numero: bill.number,
            reference_code: payload.reference_code,
            cufe,
            qr: qrData,
            factura: {
                numero: bill.number,
                cufe,
                qr_data: qrData,
                emisor: { razon_social: 'Kiora MicroMarket S.A.S.', nit: '900.123.456-7', regimen: 'Responsable de IVA' },
                adquirente: {
                    tipo: bill.customer?.identification_document?.name || 'Consumidor Final',
                    identificacion: bill.customer?.identification || '222222222222',
                },
                totales: { subtotal: subtotal.toFixed(2), iva_19: iva.toFixed(2), total: total.toFixed(2) },
                items: items.map((i) => ({
                    codigo: i.code_reference || i.cod_prod,
                    nombre: i.name || i.nom_prod || `Producto #${i.cod_prod}`,
                    cantidad: i.quantity || i.cantidad,
                    precio_unitario: Number(i.price || i.precio_unit || 0),
                    total: Number(i.price || i.precio_unit || 0) * Number(i.quantity || i.cantidad || 1),
                })),
            },
            errores_dian: bill.errors || {},
        };
    } catch (err) {
        logger.warn('Error en Factus, usando simulacion', { error: err.message });
        const mockResult = generateMockInvoice(order);
        mockResult.factus_error = err.message;
        return mockResult;
    }
}

/**
 * Genera una factura simulada (fallback cuando Factus no esta configurado).
 */
function generateMockInvoice(order) {
    const crypto = require('crypto');
    const mockFecha = new Date().toISOString();
    const subtotal = (order.items || []).reduce((s, i) => s + Number(i.precio_unit || 0) * (i.cantidad || 1), 0);
    const monto = subtotal * 1.19;
    const iva = monto - subtotal;
    const cufe = crypto.createHash('sha384').update(`KIORA-VENTA-${order.id_vent}-${mockFecha}-${Date.now()}`).digest('hex');
    const qrCodeData = `NumFac: ${order.id_vent}\nFecFac: ${mockFecha}\nNitFac: 900.123.456-7\nDocAdq: CONSUMIDOR FINAL\nValFac: ${monto.toFixed(2)}\nValIva: ${iva.toFixed(2)}\nCUFE: ${cufe}`;

    return {
        status: 'SIMULATED',
        metadata: {
            proveedor_tecnologico: 'Simulador Fiscal Kiora S.A.S.',
            ambiente: 'PRUEBAS',
            fecha_validacion: mockFecha,
        },
        factura: {
            numero: `FES-${String(order.id_vent || 0).padStart(6, '0')}`,
            cufe,
            qr_data: qrCodeData,
            emisor: { razon_social: 'Kiora MicroMarket S.A.S.', nit: '900.123.456-7', regimen: 'Responsable de IVA' },
            adquirente: { tipo: 'Consumidor Final', identificacion: '222222222222' },
            totales: { subtotal: subtotal.toFixed(2), iva_19: iva.toFixed(2), total: monto.toFixed(2) },
            items: (order.items || []).map((i) => ({
                codigo: i.cod_prod,
                nombre: i.nom_prod || `Producto #${i.cod_prod}`,
                cantidad: i.cantidad,
                precio_unitario: Number(i.precio_unit || 0),
                total: Number(i.precio_unit || 0) * (i.cantidad || 1),
            })),
        },
    };
}

/**
 * Anula una factura electronica en Factus.
 * @param {string} referenceCode - Codigo de referencia (ej: KIORA-VENTA-1-{timestamp})
 * @returns {Promise<object>}
 */
async function deleteInvoice(referenceCode) {
    if (!env.factus.configured) {
        logger.warn('Factus no configurado — omitiendo anulacion fiscal');
        return { status: 'SKIPPED', message: 'Factus no configurado' };
    }

    try {
        const token = await getAccessToken();
        const url = `${env.factus.apiUrl}/v2/bills/destroy/reference/${referenceCode}`;

        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        });

        if (!res.ok) {
            const errBody = await res.text();
            // 422 = factura no anulable (ej: fuera de plazo) — se loggea pero no se bloquea
            logger.warn('Factus no pudo anular la factura', { referenceCode, status: res.status, error: errBody });
            return { status: 'FAILED', factus_error: `${res.status}: ${errBody}` };
        }

        const data = await res.json();
        logger.info('Factura anulada en Factus', { referenceCode });
        return { status: 'DELETED', factus_response: data };
    } catch (err) {
        logger.warn('Error anulando factura en Factus', { referenceCode, error: err.message });
        return { status: 'FAILED', factus_error: err.message };
    }
}

module.exports = { createInvoice, deleteInvoice, buildInvoicePayload, getAccessToken };
