'use strict';

const Redis   = require('ioredis');
const logger  = require('../config/logger');
const { sendEmail } = require('../services/emailService');
const alertRepository = require('../repositories/alertRepository');

/**
 * Suscribe al stream Redis de notificaciones usando XREADGROUP
 * para garantizar entrega persistente con consumer groups.
 *
 * Los mensajes se persisten en el stream y se entregan una sola vez
 * por consumer group. Si el servicio se cae, al reiniciar retoma
 * los mensajes pendientes (no ACK'd).
 *
 * @param {{ host: string, port: number, password?: string, notificationsStream: string, consumerGroup: string }} redisConfig
 * @param {string} from - Dirección del remitente SMTP
 */
function startSubscriber(redisConfig, from) {
    const redis = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    const stream = redisConfig.notificationsStream;
    const group = redisConfig.consumerGroup;
    const consumer = `consumer-${process.pid}`;

    redis.on('connect', () => {
        logger.info('Subscriber Redis conectado', {
            host: redisConfig.host,
            port: redisConfig.port,
            stream,
            group,
        });
    });

    redis.on('error', (err) => {
        logger.error('Error en subscriber Redis', { error: err.message });
    });

    /**
     * Crea el consumer group si no existe.
     * '0' = leer desde el inicio del stream para nuevos groups.
     */
    async function ensureConsumerGroup() {
        try {
            await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
            logger.info('Consumer group creado', { stream, group });
        } catch (err) {
            if (err.message && err.message.includes('BUSYGROUP')) {
                logger.debug('Consumer group ya existe', { stream, group });
            } else {
                logger.error('Error creando consumer group', { error: err.message });
                throw err;
            }
        }
    }

    /**
     * Procesa un mensaje del stream: parsea el payload y envía el email.
     * @param {string} messageId
     * @param {string[]} fields - Array [key, value, key, value, ...]
     */
    async function processMessage(messageId, fields) {
        // Convertir array de fields a objeto
        const data = {};
        for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = fields[i + 1];
        }

        let payload;
        try {
            payload = JSON.parse(data.payload);
        } catch {
            logger.warn('Mensaje inválido (no es JSON), haciendo ACK y descartando', { messageId });
            await redis.xack(stream, group, messageId);
            return;
        }

        try {
            // Determinar tipo de alerta
            let tipo = 'general';
            if (payload.subject && payload.subject.toLowerCase().includes('stock')) tipo = 'stock_bajo';
            if (payload.subject && payload.subject.toLowerCase().includes('vencimiento')) tipo = 'vencimiento';

            // Guardar en la base de datos de notificaciones
            await alertRepository.saveAlert({
                tipo,
                mensaje: payload.subject || 'Notificación',
                metadata: payload
            });

            await sendEmail(payload, from);
            await redis.xack(stream, group, messageId);
            logger.debug('Mensaje procesado y ACK', { messageId, to: payload.to });
        } catch (err) {
            logger.error('Error al enviar email, NO se hizo ACK (se reintentará)', {
                messageId,
                to: payload.to,
                subject: payload.subject,
                error: err.message,
            });
            // No hacer ACK — el mensaje quedará como pending y se reintentará
        }
    }

    /**
     * Procesa mensajes pendientes (no ACK'd) que quedaron de ejecuciones anteriores.
     */
    async function processPending() {
        try {
            const result = await redis.xreadgroup(
                'GROUP', group, consumer,
                'COUNT', 10,
                'STREAMS', stream, '0' // '0' = leer pending entries
            );

            if (!result) return;

            for (const [, messages] of result) {
                for (const [messageId, fields] of messages) {
                    await processMessage(messageId, fields);
                }
            }
        } catch (err) {
            logger.error('Error procesando mensajes pendientes', { error: err.message });
        }
    }

    /**
     * Loop principal: escucha nuevos mensajes con XREADGROUP + BLOCK.
     */
    async function readLoop() {
        // Primero, procesar mensajes pendientes
        await processPending();

        // Bucle de consumo continuo (XREADGROUP + BLOCK)
        for (;;) {
            try {
                const result = await redis.xreadgroup(
                    'GROUP', group, consumer,
                    'COUNT', 10,
                    'BLOCK', 5000, // Bloquear 5s esperando nuevos mensajes
                    'STREAMS', stream, '>' // '>' = solo mensajes nuevos
                );

                if (!result) continue; // timeout, sin mensajes

                for (const [, messages] of result) {
                    for (const [messageId, fields] of messages) {
                        await processMessage(messageId, fields);
                    }
                }
            } catch (err) {
                if (err.message && err.message.includes('NOGROUP')) {
                    // El group fue eliminado, recrearlo
                    await ensureConsumerGroup();
                    continue;
                }
                logger.error('Error en read loop', { error: err.message });
                // Esperar antes de reintentar
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    }

    // Iniciar
    ensureConsumerGroup()
        .then(() => {
            logger.info(`Escuchando stream ${stream} con consumer group ${group}`);
            readLoop();
        })
        .catch((err) => {
            logger.error('No se pudo iniciar el subscriber de Redis Streams', { error: err.message });
        });

    return redis;
}

module.exports = { startSubscriber };
