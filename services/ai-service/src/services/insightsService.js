const { callDeepSeek } = require('./deepseekService');
const { buildSystemContext } = require('./contextBuilder');

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
let cache = null;
let cacheExpiry = 0;

/**
 * Genera insights automáticos del negocio con caché.
 * @returns {Promise<{insight:string,trend_percentage:number,trend_direction:string,trend_comparison:string,timestamp:string}>}
 */
async function generateInsights() {
  const now = Date.now();
  if (cache && now < cacheExpiry) return cache;

  const contextData = await buildSystemContext().catch(() => null);

  const systemPrompt = `Eres un analista de negocio para Kiora POS. Genera exactamente 1 insight accionable basado en los datos actuales.

REGLAS:
- El insight debe ser breve, concreto y accionable (máximo 200 caracteres)
- Calcula la tendencia de rendimiento comparando con la semana pasada
- El insight debe mencionar datos específicos del contexto, no genéricos
- Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional

Formato de respuesta:
{
  "insight": "texto del insight aquí, con datos específicos",
  "trend_percentage": 18,
  "trend_direction": "up",
  "trend_comparison": "vs semana pasada"
}

Datos actuales del negocio:
${contextData || 'No hay datos disponibles en este momento.'}`;

  try {
    const result = await callDeepSeek(
      [{ role: 'system', content: systemPrompt }],
      [] // sin tools para respuestas más rápidas
    );

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      // Fallback: extraer JSON del texto
      const match = result.content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('No se pudo parsear la respuesta');
    }

    const output = {
      insight: parsed.insight || 'No hay suficientes datos para generar un insight en este momento.',
      trend_percentage: parsed.trend_percentage ?? 0,
      trend_direction: parsed.trend_direction === 'down' ? 'down' : 'up',
      trend_comparison: parsed.trend_comparison || 'vs semana pasada',
      timestamp: new Date().toISOString(),
    };

    cache = output;
    cacheExpiry = now + CACHE_TTL;
    return output;
  } catch (err) {
    // Si hay cache expirado pero tenemos datos, servirlos como fallback
    if (cache) return cache;
    throw err;
  }
}

/** Limpia el caché forzadamente */
function clearCache() {
  cache = null;
  cacheExpiry = 0;
}

module.exports = { generateInsights, clearCache };
