const Redis = require('ioredis');

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'kiora-redis',
  port: Number(process.env.REDIS_PORT) || 6379,
});

const REDIS_STREAM = process.env.REDIS_NOTIFICATIONS_STREAM || 'kiora:notifications:stream';
const HISTORY_EXPIRATION = 86400; // 24 horas

async function saveTelegramHistory(chatId, role, content) {
  const key = `kiora:telegram_history:${chatId}`;
  await redisClient.rpush(key, JSON.stringify({ role, content }));
  // Mantener solo los últimos 20 mensajes
  await redisClient.ltrim(key, -20, -1);
  await redisClient.expire(key, HISTORY_EXPIRATION);
}

async function getTelegramHistory(chatId) {
  const key = `kiora:telegram_history:${chatId}`;
  const messages = await redisClient.lrange(key, 0, -1);
  return messages.map(msg => JSON.parse(msg));
}

async function sendTelegramNotification(subject, htmlContent) {
  try {
    const payload = JSON.stringify({ subject, html: htmlContent });
    await redisClient.xadd(REDIS_STREAM, '*', 'payload', payload);
    return true;
  } catch (error) {
    console.error('[telegramService] Error enviando notificación:', error.message);
    return false;
  }
}

module.exports = {
  saveTelegramHistory,
  getTelegramHistory,
  sendTelegramNotification,
  redisClient
};
