import dotenv from 'dotenv';
dotenv.config();

import { Telegraf, Context } from 'telegraf';
import cron from 'node-cron';
import { createRedisClient } from '@kiora/shared';
import { escapeHtml, formatMessageToHtml } from './utils';

const logger = {
    info: (msg: string, data?: any) => console.log(JSON.stringify({ level: 'info', message: msg, ...data })),
    warn: (msg: string, data?: any) => console.warn(JSON.stringify({ level: 'warn', message: msg, ...data })),
    error: (msg: string, data?: any) => console.error(JSON.stringify({ level: 'error', message: msg, ...data })),
};

// ── Config ──────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API_BASE = process.env.API_GATEWAY_URL || 'http://api-gateway:3000/api';
const API_KEY = process.env.KIORA_API_KEY;

if (!BOT_TOKEN) {
    logger.error('TELEGRAM_BOT_TOKEN no configurado');
    process.exit(1);
}

const REDIS_STREAM = process.env.REDIS_NOTIFICATIONS_STREAM || 'kiora:notifications:stream';
const REDIS_GROUP = 'telegram-bot-group';
const REDIS_CONSUMER = `consumer-${process.pid}`;

// ── Inicializar bot ────────────────────────────────────────────────────
const bot = new Telegraf(BOT_TOKEN);

let adminChatId: string | number | undefined = CHAT_ID;

// Helper para enviar HTML escapado
function sendHtml(ctx: Context, text: string) {
    return ctx.reply(text, { parse_mode: 'HTML' });
}

// ── Comando /start — detecta el Chat ID ────────────────────────────────
bot.start((ctx) => {
    if (CHAT_ID && String(ctx.chat?.id) !== String(CHAT_ID)) {
        logger.warn('Intento de inicio no autorizado', { chatId: ctx.chat?.id });
        return;
    }
    adminChatId = ctx.chat?.id;
    logger.info('Chat ID detectado/confirmado', { chatId: adminChatId });
    sendHtml(ctx,
        '<b>✅ Kiora Bot conectado</b>\n\n' +
        `Chat ID: <code>${adminChatId}</code>\n\n` +
        '<b>Comandos:</b>\n' +
        '/stock — Productos con stock crítico\n' +
        '/ventas_hoy — Ventas del día\n' +
        '/servicios — Estado de servicios\n' +
        '/productos — Listado de productos\n' +
        '/help — Todos los comandos'
    );
});

bot.help((ctx) => sendHtml(ctx,
    '<b>/stock</b> — Productos con stock crítico\n' +
    '<b>/ventas_hoy</b> — Ventas del día\n' +
    '<b>/servicios</b> — Estado de los microservicios\n' +
    '<b>/productos</b> — Listado de productos'
));

// ── Interfaces ─────────────────────────────────────────────────────────
export interface Product {
    cod_prod?: string;
    nom_prod: string;
    stock?: number;
    stock_actual?: number;
    stock_minimo?: number;
    precio_unitario?: string | number;
}

export interface Order {
    fecha_vent: string;
    montofinal_vent: string | number;
}

export interface Batch {
    numero_lote: string;
    nom_prod: string;
    fecha_vencimiento: string;
    cantidad_actual: number;
}

export interface ServiceHealth {
    status: 'up' | 'down' | string;
}

export interface ApiResponse<T> {
    data?: T;
    lowStock?: Product[];
    expiringBatches?: Batch[];
    services?: Record<string, ServiceHealth>;
}

// ── API helper ─────────────────────────────────────────────────────────
async function apiGet<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'x-api-key': API_KEY || '' },
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<ApiResponse<T>>;
}

async function apiPost<T = unknown>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
            'x-api-key': API_KEY || '',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<ApiResponse<T>>;
}

// ── Comandos ───────────────────────────────────────────────────────────

bot.command('stock', async (ctx) => {
    try {
        const data = await apiGet<Product[]>('/products/low-stock');
        const products = data.data || [];
        if (products.length === 0) return sendHtml(ctx, '✅ No hay productos con stock crítico.');
        const msg = products.map((p) =>
            `⚠️ <b>${escapeHtml(p.nom_prod)}</b> — Stock: ${p.stock_actual} / Mín: ${p.stock_minimo}`
        ).join('\n');
        sendHtml(ctx, `<b>📦 Stock Crítico:</b>\n\n${msg}`);
    } catch (e) {
        sendHtml(ctx, '❌ Error al consultar stock.');
    }
});

bot.command('ventas_hoy', async (ctx) => {
    try {
        const data = await apiGet<Order[]>('/orders?limit=100');
        const orders = data.data || [];
        const hoy = new Date().toISOString().slice(0, 10);
        const hoyVentas = orders.filter((o) => o.fecha_vent?.startsWith(hoy));
        const total = hoyVentas.reduce((s, o) => s + Number(o.montofinal_vent || 0), 0);
        const ticketProm = hoyVentas.length ? Math.round(total / hoyVentas.length) : 0;
        sendHtml(ctx,
            `<b>📊 Ventas de hoy:</b>\n\n` +
            `Transacciones: ${hoyVentas.length}\n` +
            `Total: <b>$${total.toLocaleString('es-CO')}</b>\n` +
            `Ticket prom: <b>$${ticketProm.toLocaleString('es-CO')}</b>`
        );
    } catch {
        sendHtml(ctx, '❌ Error al consultar ventas.');
    }
});

bot.command('servicios', async (ctx) => {
    try {
        const data = await apiGet<void>('/../health/all');
        const lines = Object.entries(data.services || {}).map(([name, svc]) =>
            `${svc.status === 'up' ? '✅' : '❌'} <b>${name}</b> — ${svc.status}`
        );
        sendHtml(ctx, `<b>🔧 Estado de Servicios:</b>\n\n${lines.join('\n')}`);
    } catch {
        sendHtml(ctx, '❌ Error al consultar servicios.');
    }
});

bot.command('productos', async (ctx) => {
    try {
        const data = await apiGet<Product[]>('/products');
        const products = data.data || [];
        const msg = products.slice(0, 20).map((p) =>
            `<b>${escapeHtml(p.nom_prod)}</b> — $${Number(p.precio_unitario || 0).toLocaleString('es-CO')} | Stock: ${p.stock_actual}`
        ).join('\n');
        sendHtml(ctx, `<b>📦 Productos (${products.length}):</b>\n\n${msg}`);
    } catch {
        sendHtml(ctx, '❌ Error al consultar productos.');
    }
});

bot.on('text', async (ctx) => {
    // Seguridad: Ignorar mensajes que no vengan del administrador
    if (adminChatId && String(ctx.chat.id) !== String(adminChatId)) {
        logger.warn('Mensaje de texto ignorado (no es admin)', { chatId: ctx.chat.id });
        return;
    }

    try {
        await ctx.sendChatAction('typing');
        const text = ctx.message.text;

        logger.info('Enviando mensaje a AI webhook', { textLength: text.length });

        // Enviar al webhook de AI Service
        await apiPost('/v1/ai/telegram-webhook', {
            chatId: String(ctx.chat.id),
            text: text
        });

        logger.info('AI webhook respondió OK');

    } catch (e: any) {
        logger.error('Error enviando texto a AI webhook', { error: e.message });
        sendHtml(ctx, '❌ <i>La IA no está disponible en este momento.</i>');
    }
});

// ── Consumidor de Redis Streams ────────────────────────────────────────
// Usamos el cliente unificado que maneja Sentinel / Standalone
const redisClient = createRedisClient({
    name: 'telegram-bot-subscriber',
    maxRetriesPerRequest: null,
});

async function ensureConsumerGroup() {
    try {
        await redisClient.xgroup('CREATE', REDIS_STREAM, REDIS_GROUP, '$', 'MKSTREAM');
    } catch (e: any) {
        if (!e.message.includes('BUSYGROUP')) logger.warn('Grupo Redis ya existe o error', { error: e.message });
    }
}

async function processMessage(stream: string, id: string, message: string[]) {
    // message es un array plano ['payload', '{"subject":"...", "html":"..."}']
    const payloadIdx = message.indexOf('payload');
    if (payloadIdx === -1 || !message[payloadIdx + 1]) {
        await redisClient.xack(stream, REDIS_GROUP, id);
        return;
    }
    const payloadRaw = message[payloadIdx + 1];
    try {
        const payload = JSON.parse(payloadRaw);
        const { subject, html, photo_base64 } = payload;

        if (!adminChatId) {
            logger.warn('adminChatId no disponible, no se puede enviar notificación');
            await redisClient.xack(stream, REDIS_GROUP, id);
            return;
        }

        const text = formatMessageToHtml(subject, html);

        logger.info('Enviando notificación por Telegram', { subject, textLength: text.length });

        if (photo_base64) {
            await bot.telegram.sendPhoto(
                adminChatId,
                { source: Buffer.from(photo_base64, 'base64') },
                { caption: text.slice(0, 1024), parse_mode: 'HTML' }
            );
        } else {
            await bot.telegram.sendMessage(adminChatId, text.slice(0, 4000), { parse_mode: 'HTML' });
        }

        logger.info('Notificación enviada exitosamente por Telegram');

        await redisClient.xack(stream, REDIS_GROUP, id);
    } catch (e: any) {
        logger.warn('Error procesando mensaje', { error: e.message, id });
        try { await redisClient.xack(stream, REDIS_GROUP, id); } catch (_) { /* ignore */ }
    }
}

async function startConsumer() {
    await ensureConsumerGroup();
    logger.info('Consumidor Redis iniciado');

    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            if (redisClient.status !== 'ready') {
                logger.warn('Redis no disponible, reconectando...');
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }

            const results = await redisClient.xreadgroup(
                'GROUP', REDIS_GROUP, REDIS_CONSUMER,
                'COUNT', 10,
                'BLOCK', 5000,
                'STREAMS', REDIS_STREAM, '>'
            ) as any;
            
            if (!results) continue;
            for (const [stream, entries] of results) {
                for (const [id, fields] of entries) {
                    await processMessage(stream, id, fields);
                }
            }
        } catch (e: any) {
            if (e.message.includes('NOGROUP')) {
                await ensureConsumerGroup();
            } else if (e.message.includes('CLOSED') || e.message.includes('closed')) {
                logger.warn('Redis cerrado, esperando reconexión...');
                await new Promise(r => setTimeout(r, 3000));
            } else {
                logger.error('Error en consumer loop', { error: e.message });
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
}

// ── Cron Jobs ────────────────────────────────────────────────────────────

function startDailyAlerts() {
    // Ejecutar a las 8:00 AM todos los días
    cron.schedule('0 8 * * *', async () => {
        if (!adminChatId) return;
        try {
            logger.info('Ejecutando cron diario de alertas...');
            const data = await apiGet<void>('/inventory/alerts');
            
            let message = '🔔 <b>Reporte Diario de Inventario</b>\n\n';
            let hasAlerts = false;
            
            if (data.lowStock && data.lowStock.length > 0) {
                hasAlerts = true;
                message += '📉 <b>Stock Bajo:</b>\n';
                data.lowStock.slice(0, 10).forEach((item) => {
                    message += `- ${escapeHtml(item.nom_prod || 'Prod ' + item.cod_prod)}: ${item.stock} (Mín: ${item.stock_minimo})\n`;
                });
                if (data.lowStock.length > 10) message += `- ...y ${data.lowStock.length - 10} más\n`;
                message += '\n';
            }
            
            if (data.expiringBatches && data.expiringBatches.length > 0) {
                hasAlerts = true;
                message += '⚠️ <b>Lotes por Vencer (próximos 30 días):</b>\n';
                data.expiringBatches.slice(0, 10).forEach((batch) => {
                    const dateStr = new Date(batch.fecha_vencimiento).toLocaleDateString();
                    message += `- ${escapeHtml(batch.nom_prod)} [${batch.numero_lote}]: Vence ${dateStr} (Quedan: ${batch.cantidad_actual})\n`;
                });
                if (data.expiringBatches.length > 10) message += `- ...y ${data.expiringBatches.length - 10} más\n`;
                message += '\n';
            }
            
            if (hasAlerts) {
                await bot.telegram.sendMessage(adminChatId, message, { parse_mode: 'HTML' });
            } else {
                await bot.telegram.sendMessage(adminChatId, '✅ <b>Reporte Diario:</b> Todo el inventario está en niveles óptimos y no hay lotes por vencer pronto.', { parse_mode: 'HTML' });
            }
        } catch (error: any) {
            logger.error('Error en cron de alertas', { error: error.message });
        }
    });
}

// ── Handler global de errores no capturados ──────────────────────────
process.on('unhandledRejection', (err: any) => {
    logger.warn('Unhandled rejection (no crítico)', { error: err?.message || String(err) });
});
process.on('uncaughtException', (err: any) => {
    logger.warn('Uncaught exception (no crítico)', { error: err?.message || String(err) });
});

// ── Inicio ─────────────────────────────────────────────────────────────
async function main() {
    // Limpiar sesiones de polling previas (evita error 409 Conflict)
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    } catch (e: any) {
        logger.warn('Error limpiando webhook', { error: e.message });
    }

    bot.launch().catch(e => {
        logger.warn('Error en bot.launch() (posible 409)', { error: e.message });
    });
    logger.info('Bot de Telegram iniciado');

    startConsumer().catch(e => logger.error('Consumer crash', { error: e.message }));
    startDailyAlerts();

    process.once('SIGINT', () => { bot.stop('SIGINT'); redisClient.quit(); });
    process.once('SIGTERM', () => { bot.stop('SIGTERM'); redisClient.quit(); });
}

main();
