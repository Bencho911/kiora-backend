import dotenv from 'dotenv';
dotenv.config();

import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    proto,
    WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import cron from 'node-cron';
import { createRedisClient } from '@kiora/shared';
import path from 'path';
import pino from 'pino';

// Logger silencioso para Baileys (evita que sus logs internos ensucien la consola)
const baileysLogger = pino({ level: 'silent' });

// ── Logger ─────────────────────────────────────────────────────────────
const logger = {
    info:  (msg: string, data?: any) => console.log(JSON.stringify({ level: 'info',  message: msg, ...data })),
    warn:  (msg: string, data?: any) => console.warn(JSON.stringify({ level: 'warn',  message: msg, ...data })),
    error: (msg: string, data?: any) => console.error(JSON.stringify({ level: 'error', message: msg, ...data })),
};

// ── Config ──────────────────────────────────────────────────────────────
const OWNER_JID    = process.env.OWNER_JID;           // e.g. "573001234567@s.whatsapp.net"
const SESSION_DIR  = path.resolve(process.env.SESSION_DIR || './session');
const API_BASE     = process.env.API_GATEWAY_URL || 'http://api-gateway:3000/api';
const API_KEY      = process.env.KIORA_API_KEY || '';
const REDIS_STREAM    = process.env.REDIS_NOTIFICATIONS_STREAM || 'kiora:notifications:stream';
const REDIS_AI_STREAM = 'kiora:whatsapp:responses';  // Respuestas de la IA al bot
const REDIS_GROUP     = 'whatsapp-bot-group';
const REDIS_AI_GROUP  = 'whatsapp-bot-ai-group';
const REDIS_CONSUMER  = `consumer-${process.pid}`;

if (!OWNER_JID) {
    logger.error('OWNER_JID no configurado. Ejemplo: 573001234567@s.whatsapp.net');
    process.exit(1);
}

// ── API helpers ─────────────────────────────────────────────────────────
async function apiGet<T = unknown>(endpoint: string): Promise<any> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'x-api-key': API_KEY },
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
}

async function apiPost<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
}

// ── Comandos disponibles ────────────────────────────────────────────────
const HELP_MSG = `🤖 *Kiora WhatsApp Bot*

*Comandos disponibles:*
• /stock — Productos con stock crítico
• /ventas — Resumen de ventas del día
• /productos — Listado de productos
• /servicios — Estado de los servicios
• /ayuda — Muestra este menú

O simplemente *escríbeme en lenguaje natural* y te respondo con IA:
_"¿Cuánto vendí esta semana?"_
_"¿Qué producto tiene más stock?"_`;

// ── WhatsApp bot socket ─────────────────────────────────────────────────
let sock: ReturnType<typeof makeWASocket> | null = null;

// ── Rastreo de mensajes enviados por el bot para no responderse a sí mismo
const recentlySentMsgIds = new Set<string>();

async function sendMessage(jid: string, text: string) {
    if (!sock) {
        logger.warn('Socket no disponible, no se puede enviar mensaje');
        return;
    }
    try {
        const sent = await sock.sendMessage(jid, { text });
        if (sent?.key?.id) {
            recentlySentMsgIds.add(sent.key.id);
            // Limpiar memoria después de 5 min
            setTimeout(() => recentlySentMsgIds.delete(sent.key!.id!), 5 * 60 * 1000);
        }
    } catch (e: any) {
        logger.error('Error enviando mensaje WhatsApp', { error: e.message, jid });
    }
}

async function handleCommand(jid: string, command: string) {
    try {
        switch (command) {
            case '/ayuda':
            case '/help':
            case '/start':
                await sendMessage(jid, HELP_MSG);
                break;

            case '/stock': {
                const data = await apiGet('/products/low-stock');
                const products = data.data || [];
                if (products.length === 0) {
                    await sendMessage(jid, '✅ No hay productos con stock crítico.');
                    return;
                }
                const msg = products.map((p: any) =>
                    `⚠️ *${p.nom_prod}* — Stock: ${p.stock_actual} / Mín: ${p.stock_minimo}`
                ).join('\n');
                await sendMessage(jid, `📦 *Stock Crítico:*\n\n${msg}`);
                break;
            }

            case '/ventas': {
                const data = await apiGet('/orders?limit=100');
                const orders = data.data || [];
                const hoy = new Date().toISOString().slice(0, 10);
                const hoyVentas = orders.filter((o: any) => o.fecha_vent?.startsWith(hoy));
                const total = hoyVentas.reduce((s: number, o: any) => s + Number(o.montofinal_vent || 0), 0);
                const ticketProm = hoyVentas.length ? Math.round(total / hoyVentas.length) : 0;
                await sendMessage(jid,
                    `📊 *Ventas de hoy:*\n\n` +
                    `Transacciones: ${hoyVentas.length}\n` +
                    `Total: *$${total.toLocaleString('es-CO')}*\n` +
                    `Ticket promedio: *$${ticketProm.toLocaleString('es-CO')}*`
                );
                break;
            }

            case '/productos': {
                const data = await apiGet('/products?limit=20');
                const products = data.data || [];
                const msg = products.map((p: any) =>
                    `• *${p.nom_prod}* — $${Number(p.precio_prod || 0).toLocaleString('es-CO')} | Stock: ${p.stock_actual}`
                ).join('\n');
                await sendMessage(jid, `📦 *Productos (${products.length}):*\n\n${msg}`);
                break;
            }

            case '/servicios': {
                const data = await apiGet('/../health/all');
                const lines = Object.entries(data.services || {}).map(([name, svc]: [string, any]) =>
                    `${svc.status === 'up' ? '✅' : '❌'} *${name}* — ${svc.status}`
                );
                await sendMessage(jid, `🔧 *Estado de Servicios:*\n\n${lines.join('\n')}`);
                break;
            }

            default:
                await sendMessage(jid, `❓ Comando desconocido. Escribe /ayuda para ver los disponibles.`);
        }
    } catch (e: any) {
        logger.error('Error ejecutando comando', { command, error: e.message });
        await sendMessage(jid, `❌ Error al ejecutar el comando. Intenta de nuevo.`);
    }
}

async function handleFreeText(jid: string, text: string) {
    // Muestra indicador de "escribiendo..." enviando una reacción de espera
    try {
        await sendMessage(jid, '⏳ _Consultando con la IA..._');

        logger.info('Enviando mensaje a AI webhook', { textLength: text.length });

        // Misma ruta que usa el bot de Telegram, reutilizamos la infraestructura de IA
        await apiPost('/ai/whatsapp-webhook', {
            jid,
            text,
        });

        logger.info('AI webhook respondió OK');
    } catch (e: any) {
        logger.error('Error enviando texto a AI webhook', { error: e.message });
        await sendMessage(jid, '❌ _La IA no está disponible en este momento. Intenta de nuevo._');
    }
}

// ── Procesador de mensajes entrantes ───────────────────────────────────
async function onMessage(msg: WAMessage) {
    const jid = msg.key.remoteJid;
    if (!jid) return;

    // Extraer JID del remitente
    const senderJid = msg.key.fromMe ? OWNER_JID : (msg.key.participant || jid);
    
    // Logueamos todos los mensajes recibidos para ver cómo llega el JID
    logger.info('Mensaje evaluado', { senderJid, jid, fromMe: msg.key.fromMe, pushName: msg.pushName });
    
    // NOTA: temporalmente permitimos todos los mensajes para evitar el problema de @lid
    // if (senderJid !== OWNER_JID && jid !== OWNER_JID) {
    //     logger.warn('Mensaje ignorado: no es el owner', { senderJid, jid });
    //     return;
    // }

    // Ignorar si el mensaje fue enviado por el propio bot (para evitar bucles infinitos)
    if (msg.key.id && recentlySentMsgIds.has(msg.key.id)) {
        return;
    }

    // Si el mensaje es de uno mismo y no es en el chat "conmigo mismo", ignorarlo
    // (A menos que quieras que el bot procese todo lo que tú escribes en otros chats, lo cual no es ideal)
    if (msg.key.fromMe && jid !== OWNER_JID) {
        return;
    }

    const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || '';

    if (!text.trim()) return;

    logger.info('Mensaje recibido', { jid, textLength: text.length });

    // Marcar como leído
    await sock?.readMessages([msg.key]);

    if (text.startsWith('/')) {
        // Es un comando
        const command = text.split(' ')[0].toLowerCase();
        await handleCommand(jid, command);
    } else {
        // Lenguaje natural → IA
        await handleFreeText(jid, text);
    }
}

// ── Conexión y reconexión automática ────────────────────────────────────
async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    logger.info('Iniciando WhatsApp bot', { version: version.join('.') });

    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: baileysLogger,
        browser: ['Kiora Bot', 'Chrome', '1.0.0'],
        syncFullHistory: false,
    });

    // ── Eventos ─────────────────────────────────────────────────────────
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Muestra el QR en la consola para escanearlo con WhatsApp
            qrcode.generate(qr, { small: true });
            logger.info('⬆️  Escanea el código QR de arriba con WhatsApp en tu celular (Dispositivos Vinculados → Vincular Dispositivo)');
        }

        if (connection === 'close') {
            const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            logger.warn('Conexión cerrada', { reason, shouldReconnect });

            if (shouldReconnect) {
                logger.info('Reconectando en 5 segundos...');
                setTimeout(startWhatsApp, 5000);
            } else {
                logger.error('Sesión cerrada (logout). Elimina la carpeta "session" y reinicia.');
                process.exit(1);
            }
        }

        if (connection === 'open') {
            logger.info('✅ WhatsApp conectado correctamente');
            // Enviar mensaje de bienvenida al owner
            await sendMessage(OWNER_JID!, `✅ *Kiora Bot conectado* 🚀\n\nEscribe /ayuda para ver los comandos disponibles.`);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            await onMessage(msg);
        }
    });
}

// ── Redis: consumidor de notificaciones del sistema ─────────────────────
const redisClient = createRedisClient({
    name: 'whatsapp-bot-subscriber',
    maxRetriesPerRequest: null,
});

async function ensureConsumerGroup() {
    try {
        await redisClient.xgroup('CREATE', REDIS_STREAM, REDIS_GROUP, '$', 'MKSTREAM');
    } catch (e: any) {
        if (!e.message.includes('BUSYGROUP')) logger.warn('Grupo Redis ya existe', { error: e.message });
    }
}

async function processRedisMessage(stream: string, id: string, message: string[]) {
    const payloadIdx = message.indexOf('payload');
    if (payloadIdx === -1 || !message[payloadIdx + 1]) {
        await redisClient.xack(stream, REDIS_GROUP, id);
        return;
    }
    try {
        const payload = JSON.parse(message[payloadIdx + 1]);
        const { subject, html } = payload;

        if (!OWNER_JID) {
            await redisClient.xack(stream, REDIS_GROUP, id);
            return;
        }

        // Convertir HTML básico a texto plano con Markdown de WhatsApp
        const text = (html || subject || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?(b|strong)[^>]*>/gi, '*')
            .replace(/<\/?(i|em)[^>]*>/gi, '_')
            .replace(/<[^>]+>/g, '')
            .trim();

        const finalMsg = `🔔 *${subject || 'Notificación Kiora'}*\n\n${text}`;
        await sendMessage(OWNER_JID, finalMsg);

        logger.info('Notificación enviada por WhatsApp', { subject });
        await redisClient.xack(stream, REDIS_GROUP, id);
    } catch (e: any) {
        logger.warn('Error procesando mensaje Redis', { error: e.message, id });
        try { await redisClient.xack(stream, REDIS_GROUP, id); } catch (_) { /* ignore */ }
    }
}

async function startRedisConsumer() {
    await ensureConsumerGroup();
    logger.info('Consumidor Redis (notificaciones) iniciado');

    // Asegurar grupo para las respuestas de la IA
    try {
        await redisClient.xgroup('CREATE', REDIS_AI_STREAM, REDIS_AI_GROUP, '$', 'MKSTREAM');
    } catch (e: any) {
        if (!e.message.includes('BUSYGROUP')) logger.warn('Grupo AI ya existe', { error: e.message });
    }

    // Consumer loop — maneja dos streams en paralelo
    while (true) {
        try {
            if (redisClient.status !== 'ready') {
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }

            // ── Notificaciones del sistema ────────────────────────────
            const notifResults = await redisClient.xreadgroup(
                'GROUP', REDIS_GROUP, REDIS_CONSUMER,
                'COUNT', 10,
                'BLOCK', 1000,
                'STREAMS', REDIS_STREAM, '>'
            ) as any;

            if (notifResults) {
                for (const [stream, entries] of notifResults) {
                    for (const [id, fields] of entries) {
                        await processRedisMessage(stream, id, fields);
                    }
                }
            }

            // ── Respuestas de la IA (whatsapp-webhook) ────────────────
            const aiResults = await redisClient.xreadgroup(
                'GROUP', REDIS_AI_GROUP, REDIS_CONSUMER,
                'COUNT', 10,
                'BLOCK', 500,
                'STREAMS', REDIS_AI_STREAM, '>'
            ) as any;

            if (aiResults) {
                for (const [, entries] of aiResults) {
                    for (const [id, fields] of entries) {
                        const payloadIdx = (fields as string[]).indexOf('payload');
                        if (payloadIdx !== -1 && (fields as string[])[payloadIdx + 1]) {
                            try {
                                const { jid, text } = JSON.parse((fields as string[])[payloadIdx + 1]);
                                if (jid && text) await sendMessage(jid, text);
                            } catch (_) { /* ignorar mensajes malformados */ }
                        }
                        await redisClient.xack(REDIS_AI_STREAM, REDIS_AI_GROUP, id);
                    }
                }
            }

        } catch (e: any) {
            if (e.message.includes('NOGROUP')) {
                await ensureConsumerGroup();
            } else {
                logger.error('Error en consumer loop', { error: e.message });
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
}

// ── Cron: Reporte diario a las 8 AM ────────────────────────────────────
function startDailyAlerts() {
    cron.schedule('0 8 * * *', async () => {
        if (!OWNER_JID) return;
        try {
            logger.info('Ejecutando reporte diario...');
            const data = await apiGet('/inventory/alerts');

            let message = '🔔 *Reporte Diario de Inventario*\n\n';
            let hasAlerts = false;

            if (data.lowStock?.length > 0) {
                hasAlerts = true;
                message += '📉 *Stock Bajo:*\n';
                data.lowStock.slice(0, 10).forEach((item: any) => {
                    message += `- ${item.nom_prod}: ${item.stock} (Mín: ${item.stock_minimo})\n`;
                });
                if (data.lowStock.length > 10) message += `- ...y ${data.lowStock.length - 10} más\n`;
                message += '\n';
            }

            if (data.expiringBatches?.length > 0) {
                hasAlerts = true;
                message += '⚠️ *Lotes por Vencer (30 días):*\n';
                data.expiringBatches.slice(0, 10).forEach((batch: any) => {
                    const dateStr = new Date(batch.fecha_vencimiento).toLocaleDateString('es-CO');
                    message += `- ${batch.nom_prod} [${batch.numero_lote}]: Vence ${dateStr} (${batch.cantidad_actual} uds)\n`;
                });
            }

            if (!hasAlerts) {
                message = '✅ *Reporte Diario:* Todo el inventario en niveles óptimos. No hay lotes por vencer pronto.';
            }

            await sendMessage(OWNER_JID, message);
        } catch (e: any) {
            logger.error('Error en cron diario', { error: e.message });
        }
    });
}

// ── Handlers de proceso ─────────────────────────────────────────────────
process.on('unhandledRejection', (err: any) => {
    logger.warn('Unhandled rejection', { error: err?.message || String(err) });
});
process.on('uncaughtException', (err: any) => {
    logger.warn('Uncaught exception', { error: err?.message || String(err) });
});

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
    logger.info('🚀 Iniciando Kiora WhatsApp Bot...');

    await startWhatsApp();
    startRedisConsumer().catch(e => logger.error('Consumer crash', { error: e.message }));
    startDailyAlerts();

    process.once('SIGINT',  () => { redisClient.quit(); process.exit(0); });
    process.once('SIGTERM', () => { redisClient.quit(); process.exit(0); });
}

main();
