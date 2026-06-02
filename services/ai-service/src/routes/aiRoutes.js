const { Router } = require('express');
const { chatWithTools } = require('../services/deepseekService');
const { buildSystemPrompt } = require('../services/systemPrompt');
const { buildSystemContext } = require('../services/contextBuilder');
const { TOOLS, executeTool } = require('../services/toolExecutor');
const { generateInsights } = require('../services/insightsService');

const router = Router();

/**
 * POST /api/ai/ask
 * Body: { message: string, conversation?: Array<{role,content}> }
 */
router.post('/ask', async (req, res) => {
  const { message, conversation } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'El mensaje es requerido' });
  }

  try {
    const contextData = await buildSystemContext().catch(() => null);
    const systemPrompt = buildSystemPrompt(contextData);
    const systemMsg = { role: 'system', content: systemPrompt };

    const history = Array.isArray(conversation) ? conversation.slice(-20) : [];
    const messages = [systemMsg, ...history, { role: 'user', content: message }];

    const result = await chatWithTools(messages, TOOLS, executeTool);

    res.json({
      response: result.response,
      usage: result.usage
        ? {
            input_tokens: result.usage.prompt_tokens,
            output_tokens: result.usage.completion_tokens,
            total_tokens: result.usage.total_tokens,
          }
        : null,
    });
  } catch (err) {
    console.error('[AI Service] Error:', err.message);
    res.status(500).json({
      error: 'Error al procesar la consulta',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * GET /api/ai/insights
 * Genera insights automáticos del negocio (con caché de 5 min)
 */
router.get('/insights', async (_req, res) => {
  try {
    const insights = await generateInsights();
    res.json(insights);
  } catch (err) {
    console.error('[AI Service] Insights error:', err.message);
    res.status(503).json({
      error: 'No se pudieron generar insights en este momento',
      insight: 'Estamos teniendo problemas para analizar los datos. Intenta de nuevo más tarde.',
      trend_percentage: 0,
      trend_direction: 'up',
      trend_comparison: 'vs semana pasada',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/ai/insights/refresh
 * Fuerza la regeneración de insights (limpia caché)
 */
router.post('/insights/refresh', async (_req, res) => {
  try {
    const { clearCache } = require('../services/insightsService');
    clearCache();
    const insights = await generateInsights();
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ai/health
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-service' });
});

/**
 * POST /api/ai/telegram-webhook
 */
router.post('/telegram-webhook', async (req, res) => {
  const { text, chatId } = req.body;
  if (!text || !chatId) return res.status(400).json({ error: 'Missing text or chatId' });

  const { saveTelegramHistory, getTelegramHistory, sendTelegramNotification } = require('../services/telegramService');

  try {
    // 1. Guardar mensaje del usuario en el historial
    await saveTelegramHistory(chatId, 'user', text);

    // 2. Recuperar historial
    const history = await getTelegramHistory(chatId);

    // 3. Obtener contexto
    const contextData = await buildSystemContext().catch(() => null);
    const systemPrompt = buildSystemPrompt(contextData);
    const systemMsg = { role: 'system', content: systemPrompt };

    const messages = [systemMsg, ...history];

    // 4. Preguntar a la IA
    const result = await chatWithTools(messages, TOOLS, executeTool);

    // 5. Guardar respuesta en historial
    await saveTelegramHistory(chatId, 'assistant', result.response);

    // 6. Enviar notificación a Telegram (vía Redis)
    await sendTelegramNotification('🤖 Kiora AI', result.response);

    res.json({ success: true });
  } catch (err) {
    console.error('[AI Webhook] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/close-business
 */
router.post('/close-business', async (req, res) => {
  const { sendTelegramNotification, redisClient } = require('../services/telegramService');
  try {
    // 1. Bloquear negocio en Redis para no permitir más ventas (Orders Service lo debería leer)
    await redisClient.set('kiora:business_state', 'closed');

    // 2. Pedirle a la IA que genere un resumen del día
    const contextData = await buildSystemContext().catch(() => null);
    const systemPrompt = buildSystemPrompt(contextData);
    const systemMsg = { role: 'system', content: systemPrompt };
    const promptMsg = { 
      role: 'user', 
      content: 'El negocio acaba de ser cerrado por el administrador. Genera un resumen operativo del día (Ventas de hoy, productos más vendidos, stock bajo). Hazlo en un formato agradable para enviarlo por Telegram. ¡Es tu reporte de cierre diario!' 
    };

    const messages = [systemMsg, promptMsg];
    const result = await chatWithTools(messages, TOOLS, executeTool);

    // 3. Enviar a Telegram
    await sendTelegramNotification('🛑 Cierre de Negocio', result.response);

    res.json({ success: true, message: 'Negocio cerrado. Resumen enviado por Telegram.' });
  } catch (err) {
    console.error('[AI Close Business] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/open-business
 */
router.post('/open-business', async (req, res) => {
  const { sendTelegramNotification, redisClient } = require('../services/telegramService');
  try {
    await redisClient.set('kiora:business_state', 'open');
    await sendTelegramNotification('🟢 Apertura de Negocio', 'El negocio ha sido abierto y el sistema está listo para recibir ventas.');
    res.json({ success: true, message: 'Negocio abierto.' });
  } catch (err) {
    console.error('[AI Open Business] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ai/business-state
 */
router.get('/business-state', async (req, res) => {
  const { redisClient } = require('../services/telegramService');
  try {
    const state = await redisClient.get('kiora:business_state');
    // Si no existe, asumimos que está abierto
    res.json({ state: state || 'open' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
