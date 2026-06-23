'use strict';

const logger = require('../config/logger');

/**
 * factusService
 *
 * Integración con la API de Factus v2 para facturación electrónica
 * ante la DIAN (Colombia).
 *
 * Responsabilidades:
 * - Autenticación OAuth2 con caché de token (1h)
 * - Crear y validar facturas electrónicas (Bills)
 * - Crear notas crédito (Credit Notes) para reembolsos
 * - Consultar facturas existentes
 */

const FACTUS_API_URL   = process.env.FACTUS_API_URL || 'https://api-sandbox.factus.com.co';
const CLIENT_ID        = process.env.FACTUS_CLIENT_ID;
const CLIENT_SECRET    = process.env.FACTUS_CLIENT_SECRET;
const USERNAME         = process.env.FACTUS_USERNAME;
const PASSWORD         = process.env.FACTUS_PASSWORD;
const NUMBERING_RANGE  = parseInt(process.env.FACTUS_NUMBERING_RANGE_ID, 10) || 389;
const NC_RANGE_ID      = parseInt(process.env.FACTUS_NC_RANGE_ID, 10) || 390;

/* ── Token cache ─────────────────────────────────────────────────────────── */

let _cachedToken = null;
let _tokenExpiresAt = 0;
let _refreshToken = null;

/**
 * Obtiene un access_token válido. Lo cachea durante su tiempo de vida
 * y usa refresh_token si el actual expiró.
 */
async function getAccessToken() {
    const now = Date.now();

    // Si el token aún es válido (con 60s de margen), reutilizarlo
    if (_cachedToken && now < _tokenExpiresAt - 60_000) {
        return _cachedToken;
    }

    const body = new URLSearchParams({
        grant_type: 'password',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username: USERNAME,
        password: PASSWORD,
    });

    const res = await fetch(`${FACTUS_API_URL}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: body.toString(),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Factus auth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    _cachedToken    = data.access_token;
    _refreshToken   = data.refresh_token;
    _tokenExpiresAt = now + (data.expires_in * 1000);

    logger.info('Factus: token OAuth2 obtenido', { expiresIn: data.expires_in });
    return _cachedToken;
}

/**
 * Helper para llamadas autenticadas a la API de Factus.
 */
async function factusRequest(method, path, body = null) {
    const token = await getAccessToken();
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${FACTUS_API_URL}${path}`, options);
    const data = await res.json();

    if (!res.ok) {
        const errMsg = data?.data?.errors
            ? JSON.stringify(data.data.errors)
            : data?.message || res.statusText;
        const err = new Error(`Factus API error (${res.status}): ${errMsg}`);
        err.status = res.status;
        err.factusErrors = data?.data?.errors || null;
        throw err;
    }

    return data;
}

/* ── Mapeo de productos Kiora → ítems Factus ─────────────────────────── */

/**
 * Mapea el payment method de Kiora al código de Factus.
 * @param {string} metodopago — 'efectivo', 'tarjeta', 'stripe', etc.
 * @returns {string} Código de método de pago de Factus
 */
function mapPaymentMethodCode(metodopago) {
    const map = {
        efectivo: '10',       // Efectivo
        tarjeta: '48',        // Tarjeta débito/crédito
        stripe: '48',         // Stripe = tarjeta
        transferencia: '42',  // Consignación o transferencia
    };
    return map[(metodopago || 'efectivo').toLowerCase()] || '10';
}

/**
 * Construye un ítem de Factus a partir de un Producto_Venta de Kiora.
 *
 * @param {{ cod_prod, nom_prod, cantidad, precio_unit, tax_status }} item
 * @returns {object} Ítem en formato Factus v2
 */
function buildFactusItem(item) {
    const taxStatus = (item.tax_status || '19').toUpperCase();
    const factusItem = {
        code_reference: String(item.cod_prod),
        name: item.nom_prod || `Producto #${item.cod_prod}`,
        quantity: Number(item.cantidad),
        discount_rate: 0,
        price: Number(item.precio_unit),
        unit_measure_code: '94',     // unidad
        standard_code: '999',        // Estándar de adopción del contribuyente
    };

    if (taxStatus === 'EXCLUIDO') {
        // Producto excluido de IVA: no genera IVA, sin bloque taxes
        factusItem.is_excluded = 1;
        factusItem.taxes = [];
    } else if (taxStatus === 'EXENTO') {
        // Producto exento: tarifa 0%, el productor puede pedir devolución del IVA
        factusItem.is_excluded = 0;
        factusItem.taxes = [{ code: '01', rate: '0.00' }];
    } else {
        // IVA 19% (default)
        factusItem.is_excluded = 0;
        factusItem.taxes = [{ code: '01', rate: '19.00' }];
    }

    return factusItem;
}

/* ── Crear factura electrónica ───────────────────────────────────────────── */

/**
 * Crea y valida una factura electrónica ante la DIAN vía Factus.
 *
 * @param {object} order — La venta de Kiora { id_vent, montofinal_vent, metodopago_usu }
 * @param {Array}  items — Los Producto_Venta { cod_prod, nom_prod, cantidad, precio_unit, tax_status }
 * @param {object} [customer] — Datos opcionales del cliente (cédula, nombre, etc.)
 * @returns {{ number, cufe, public_url, qr_link }} Datos de la factura emitida
 */
async function createInvoice(order, items, customer = null) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const referenceCode = `KIORA-${order.id_vent}`;

    // Construir datos del cliente (Consumidor Final por defecto)
    const customerData = customer ? {
        identification_document_id: customer.identification_document_id || 6,
        identification: String(customer.identification),
        names: customer.names,
        address: customer.address || 'No informado',
        email: customer.email || null,
        phone: customer.phone || null,
        legal_organization_id: customer.legal_organization_id || 2,
        tribute_id: customer.tribute_id || 21,
    } : {
        identification_document_id: 6,   // Cédula de ciudadanía
        identification: '222222222222',
        names: 'Consumidor final',
        address: 'No informado',
        legal_organization_id: 2,        // Persona Natural
        tribute_id: 21,                  // No aplica (ZZ)
    };

    const body = {
        numbering_range_id: NUMBERING_RANGE,
        reference_code: referenceCode,
        observation: `Venta Kiora #${order.id_vent}`,
        payment_details: [{
            payment_form: 1,  // Pago de contado
            payment_method_code: mapPaymentMethodCode(order.metodopago_usu),
            amount: Number(order.montofinal_vent),
            payment_due_date: today,
        }],
        customer: customerData,
        items: items.map(buildFactusItem),
    };

    logger.info('Factus: emitiendo factura electrónica', {
        referenceCode,
        orderId: order.id_vent,
        totalItems: items.length,
        amount: order.montofinal_vent,
    });

    const result = await factusRequest('POST', '/v2/bills/validate', body);

    const invoice = result.data;
    const output = {
        number: invoice.number,
        cufe: invoice.cufe,
        public_url: invoice.links?.public_url || null,
        qr_link: invoice.links?.qr || null,
        reference_code: referenceCode,
    };

    logger.info('Factus: factura emitida y validada por DIAN', {
        number: output.number,
        cufe: output.cufe?.substring(0, 20) + '...',
        orderId: order.id_vent,
    });

    return output;
}

/* ── Crear nota crédito (reembolso fiscal) ───────────────────────────────── */

/**
 * Emite una nota crédito ante la DIAN para anular fiscalmente una factura.
 *
 * @param {string} billNumber — El número de la factura original (ej: 'SETP990002744')
 * @param {object} order — La venta de Kiora
 * @param {Array}  items — Los ítems de la venta
 * @returns {{ number, cufe }} Datos de la nota crédito emitida
 */
async function createCreditNote(billNumber, order, items) {
    const today = new Date().toISOString().split('T')[0];
    const referenceCode = `KIORA-NC-${order.id_vent}`;

    const body = {
        numbering_range_id: NC_RANGE_ID,
        reference_code: referenceCode,
        bill_number: billNumber,
        correction_concept_code: 2, // Anulación de factura electrónica
        observation: `Anulación de factura por reembolso — Venta #${order.id_vent}`,
        payment_details: [{
            payment_form: 1,
            payment_method_code: mapPaymentMethodCode(order.metodopago_usu),
            amount: Number(order.montofinal_vent),
            payment_due_date: today,
        }],
        customer: {
            identification_document_id: 6,
            identification: '222222222222',
            names: 'Consumidor final',
            address: 'No informado',
            legal_organization_id: 2,
            tribute_id: 21,
        },
        items: items.map(buildFactusItem),
    };

    logger.info('Factus: emitiendo nota crédito', {
        referenceCode,
        billNumber,
        orderId: order.id_vent,
    });

    const result = await factusRequest('POST', '/v2/credit-notes/validate', body);

    const nc = result.data;
    logger.info('Factus: nota crédito emitida y validada por DIAN', {
        number: nc.number,
        billNumber,
        orderId: order.id_vent,
    });

    return {
        number: nc.number,
        cufe: nc.cufe,
    };
}

/* ── Consultar factura ───────────────────────────────────────────────────── */

/**
 * Consulta una factura existente en Factus por su número.
 * @param {string} number — Número de la factura (ej: 'SETP990002744')
 */
async function getInvoice(number) {
    return factusRequest('GET', `/v2/bills/${number}`);
}

/* ── Exportar ────────────────────────────────────────────────────────────── */

module.exports = {
    createInvoice,
    createCreditNote,
    getInvoice,
    // Expuestos para testing
    getAccessToken,
    buildFactusItem,
    mapPaymentMethodCode,
};
