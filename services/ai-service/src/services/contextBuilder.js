const GATEWAY = process.env.API_GATEWAY_URL || 'http://localhost:3000/api';
const FETCH_TIMEOUT = 5000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': process.env.API_KEY || '' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Los endpoints de products-service devuelven { data: [...] }, destriparlo
    if (json && typeof json === 'object' && 'data' in json) {
      return json.data;
    }
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function formatCurrency(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
}

/**
 * Recolecta datos de contexto de los microservicios internos.
 * @returns {Promise<string>} Texto de contexto para el system prompt.
 */
async function buildSystemContext() {
  const parts = [];

  // 1. Stats del dashboard
  const stats = await fetchJson(`${GATEWAY}/dashboard/stats`);
  if (stats) {
    parts.push(`--- DATOS DEL DASHBOARD ---`);
    parts.push(`Ventas hoy: ${stats.ventas_hoy ?? stats.ventasHoy ?? 'N/A'} (total: ${formatCurrency(stats.monto_total ?? stats.totalHoy ?? 0)})`);
    parts.push(`Ticket promedio: ${formatCurrency(stats.ticket_promedio ?? stats.ticketPromedio ?? 0)}`);
    parts.push(`Última venta: $${Number(stats.ultima_venta?.montofinal_vent ?? 0).toLocaleString('es-CO')} (${stats.ultima_venta?.metodopago_usu ?? 'N/A'})`);
    parts.push(`Total ventas hoy: ${stats.ventas_hoy ?? 0}`);
  }

  // 2. Productos con stock bajo
  const lowStock = await fetchJson(`${GATEWAY}/products/low-stock`);
  if (Array.isArray(lowStock) && lowStock.length > 0) {
    parts.push(`\n--- PRODUCTOS CON STOCK BAJO (${lowStock.length}) ---`);
    lowStock.slice(0, 10).forEach(p => {
      parts.push(`- ${p.nom_prod ?? p.name}: ${p.stock_actual ?? p.stock ?? 0} unidades (mínimo: ${p.stock_minimo ?? p.minStock ?? 0})`);
    });
  }

  // 3. Categorias disponibles
  const categories = await fetchJson(`${GATEWAY}/categories`);
  if (Array.isArray(categories) && categories.length > 0) {
    parts.push(`\n--- CATEGORÍAS (${categories.length}) ---`);
    parts.push(categories.map(c => c.nom_cat ?? c.name).join(', '));
  }

  return parts.join('\n');
}

module.exports = { buildSystemContext };
