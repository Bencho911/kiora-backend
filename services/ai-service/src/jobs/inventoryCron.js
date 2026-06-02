const cron = require('node-cron');
const { sendTelegramNotification, redisClient } = require('../services/telegramService');
const { chatWithTools } = require('../services/deepseekService');
const { buildSystemPrompt } = require('../services/systemPrompt');
const { buildSystemContext } = require('../services/contextBuilder');
const { TOOLS, executeTool } = require('../services/toolExecutor');

// Función que ejecuta el análisis de inventario de forma autónoma
async function runAutonomousInventoryCheck() {
  console.log('[Cron] Iniciando revisión autónoma de inventario...');
  
  // Usar Redis para evitar que múltiples instancias del servidor corran el cron a la vez
  const lockKey = 'kiora:cron:inventory_check_lock';
  const lock = await redisClient.set(lockKey, 'locked', 'NX', 'EX', 300); // 5 minutos de bloqueo
  
  if (!lock) {
    console.log('[Cron] Otra instancia ya está ejecutando esta tarea. Omitiendo.');
    return;
  }

  try {
    const contextData = await buildSystemContext().catch(() => null);
    const systemPrompt = buildSystemPrompt(contextData);
    const systemMsg = { role: 'system', content: systemPrompt };
    
    // Instrucción para la IA (actuar por iniciativa propia)
    const promptMsg = { 
      role: 'user', 
      content: 'Eres el asistente autónomo del negocio. Acabas de revisar el inventario. Analiza si hay productos críticos (bajo stock) y escribe un mensaje PROACTIVO al administrador informándole. Si encuentras productos bajos, ofrécele enviarle un correo al proveedor (ej. "Tengo X productos bajos, ¿quieres que envíe el correo a Postobon pidiendo Y unidades?"). Si todo está bien, envíale un mensaje de tranquilidad.' 
    };

    const messages = [systemMsg, promptMsg];
    const result = await chatWithTools(messages, TOOLS, executeTool);

    // Enviar a Telegram
    await sendTelegramNotification('🤖 Reporte Autónomo de Inventario', result.response);
    console.log('[Cron] Reporte enviado a Telegram exitosamente.');

  } catch (error) {
    console.error('[Cron] Error en la revisión autónoma:', error.message);
  }
}

function startCronJobs() {
  // Ejecutar todos los días a las 9:00 AM (hora del servidor)
  cron.schedule('0 9 * * *', () => {
    runAutonomousInventoryCheck();
  });
  console.log('[Cron] Tareas programadas iniciadas.');
}

module.exports = { startCronJobs, runAutonomousInventoryCheck };
