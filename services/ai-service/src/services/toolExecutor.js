const GATEWAY = process.env.API_GATEWAY_URL || 'http://localhost:3000/api';
const FETCH_TIMEOUT = 5000;

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      ...options,
      headers: { 
        'x-api-key': process.env.API_KEY || '',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      signal: controller.signal,
    });
    
    // Some endpoints might return 204 No Content
    if (res.status === 204) return { success: true };
    if (!res.ok) {
        let errText = await res.text().catch(() => '');
        return { error: `HTTP ${res.status}: ${errText}` };
    }
    
    const json = await res.json();
    if (json && typeof json === 'object' && 'data' in json && !json.error) {
      return json.data;
    }
    return json;
  } catch (err) {
    return { error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_sales_summary',
      description: 'Obtener resumen de ventas para un período específico',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'yesterday', 'week', 'month'], description: 'Período' },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_low_stock_products',
      description: 'Obtener productos con stock bajo o crítico',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_catalog',
      description: 'Obtener el catálogo de productos (filtro por categoría o búsqueda por nombre)',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Buscar por nombre (opcional)' },
          category_id: { type: 'number', description: 'ID de categoría (opcional)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_service_health',
      description: 'Obtener estado de salud de todos los servicios del sistema',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_daily_settlement',
      description: 'Obtener el corte de caja del día',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD (default: hoy)' },
        },
      },
    },
  },
  // NUEVAS HERRAMIENTAS
  {
    type: 'function',
    function: {
      name: 'update_product_stock',
      description: 'Suma o resta inventario de un producto',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID del producto' },
          cantidad: { type: 'number', description: 'Cantidad a sumar (positivo) o restar (negativo)' },
        },
        required: ['id', 'cantidad'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_product_price',
      description: 'Cambiar el precio unitario de un producto',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID del producto' },
          new_price: { type: 'number', description: 'Nuevo precio unitario' },
        },
        required: ['id', 'new_price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_maintenance_incident',
      description: 'Crear un reporte de falla, mantenimiento o incidente',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título corto del incidente' },
          descripcion: { type: 'string', description: 'Detalle descriptivo' },
          prioridad: { type: 'string', enum: ['baja', 'media', 'alta'], description: 'Prioridad' },
        },
        required: ['titulo', 'descripcion', 'prioridad'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sales_heat_map',
      description: 'Analizar ventas recientes agrupadas por hora del día para detectar picos',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_underperforming_products',
      description: 'Obtener productos con buen stock pero pocas o ninguna venta',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'predict_stock_depletion',
      description: 'Predecir días de stock restantes basado en ventas de la última semana',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'number', description: 'ID del producto a analizar' },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_system_cache',
      description: 'Limpia la memoria caché del AI y fuerza una reevaluación de los datos',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_daily_report_email',
      description: 'Envía un resumen de ventas del día por email simulado/notificación',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_supplier_email',
      description: 'Envía un correo electrónico a un proveedor solicitando inventario (simulado)',
      parameters: {
        type: 'object',
        properties: {
          supplier_email: { type: 'string', description: 'Correo del proveedor' },
          subject: { type: 'string', description: 'Asunto del correo' },
          body: { type: 'string', description: 'Cuerpo del mensaje' },
        },
        required: ['supplier_email', 'subject', 'body'],
      },
    },
  }
];

/**
 * Ejecuta una tool llamando al microservicio correspondiente.
 */
async function executeTool(name, args) {
  switch (name) {
    case 'get_sales_summary': {
      const endpoint = args.period === 'today' ? '/dashboard/stats' : `/orders?period=${args.period}`;
      const data = await fetchJson(`${GATEWAY}${endpoint}`);
      if (data.error) return data;
      return { period: args.period, data };
    }
    case 'get_low_stock_products': {
      const data = await fetchJson(`${GATEWAY}/products/low-stock`);
      return Array.isArray(data) ? data : (data.error ? data : []);
    }
    case 'get_product_catalog': {
      let url = `${GATEWAY}/products`;
      if (args.search) url += `?search=${encodeURIComponent(args.search)}`;
      if (args.category_id) url += `${args.search ? '&' : '?'}category=${args.category_id}`;
      const data = await fetchJson(url);
      return Array.isArray(data) ? data : (data.error ? data : []);
    }
    case 'get_service_health': {
      const data = await fetchJson(`${GATEWAY.replace('/api', '')}/health/all`);
      return data || { error: 'No se pudo obtener health check' };
    }
    case 'get_daily_settlement': {
      const date = args.date || new Date().toISOString().split('T')[0];
      const data = await fetchJson(`${GATEWAY}/orders/settlement/daily?date=${date}`);
      return data || { date, message: 'No hay datos para esta fecha' };
    }

    // --- NUEVAS HERRAMIENTAS ---
    
    case 'update_product_stock': {
      return await fetchJson(`${GATEWAY}/products/${args.id}/stock`, {
        method: 'PUT',
        body: JSON.stringify({ cantidad: args.cantidad })
      });
    }

    case 'update_product_price': {
      // 1. Obtener producto original
      const product = await fetchJson(`${GATEWAY}/products/${args.id}`);
      if (product.error) return product;
      if (!product || Object.keys(product).length === 0) return { error: "Producto no encontrado" };
      
      // 2. Modificar el precio conservando lo demás (solo necesitamos mandar campos clave permitidos)
      const updatePayload = {
        nom_prod: product.nom_prod,
        precio_unitario: args.new_price,
        fk_cod_cats: product.categoria?.cod_cat ? [product.categoria.cod_cat] : [],
        stock_actual: product.stock_actual,
        stock_minimo: product.stock_minimo
      };
      
      return await fetchJson(`${GATEWAY}/products/${args.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload)
      });
    }

    case 'create_maintenance_incident': {
      return await fetchJson(`${GATEWAY}/users/incidents`, {
        method: 'POST',
        body: JSON.stringify({
          titulo: args.titulo,
          descripcion: args.descripcion,
          prioridad: args.prioridad,
          fk_id_usu: 1 // Por defecto
        })
      });
    }

    case 'get_sales_heat_map': {
      const orders = await fetchJson(`${GATEWAY}/orders?period=week`);
      if (orders.error) return orders;
      if (!Array.isArray(orders)) return { error: "Formato inesperado", data: orders };
      
      const heatMap = {};
      orders.forEach(o => {
        const date = new Date(o.fecha_ord);
        const hour = date.getHours() + ':00';
        heatMap[hour] = (heatMap[hour] || 0) + 1;
      });
      return { msg: "Ventas de la última semana agrupadas por hora", heatMap };
    }

    case 'get_underperforming_products': {
      // Cruzar stats vs productos
      const stats = await fetchJson(`${GATEWAY}/dashboard/stats`);
      const products = await fetchJson(`${GATEWAY}/products`);
      if (stats.error || products.error) return { error: "Error obteniendo datos" };
      
      const salesSet = new Set(stats.productosMasVendidos?.map(p => p.nom_prod) || []);
      const stagnant = (Array.isArray(products) ? products : []).filter(p => p.stock_actual > 10 && !salesSet.has(p.nom_prod));
      return { count: stagnant.length, items: stagnant.slice(0, 10).map(p => ({ id: p.cod_prod, nombre: p.nom_prod, stock: p.stock_actual })) };
    }

    case 'predict_stock_depletion': {
      const product = await fetchJson(`${GATEWAY}/products/${args.product_id}`);
      if (product.error || !product.cod_prod) return { error: "Producto no encontrado" };
      
      const orders = await fetchJson(`${GATEWAY}/orders?period=week`);
      let unitsSold = 0;
      if (Array.isArray(orders)) {
        orders.forEach(o => {
          o.detalles?.forEach(d => {
            if (d.fk_cod_prod === args.product_id) unitsSold += d.cant_prod;
          });
        });
      }
      
      const dailyVelocity = unitsSold / 7;
      const daysLeft = dailyVelocity > 0 ? (product.stock_actual / dailyVelocity).toFixed(1) : 'Incalculable (Sin ventas recientes)';
      
      return {
        product: product.nom_prod,
        stock_actual: product.stock_actual,
        ventas_ultimos_7_dias: unitsSold,
        velocidad_diaria: dailyVelocity.toFixed(2),
        dias_estimados_restantes: daysLeft
      };
    }

    case 'clear_system_cache': {
      // Refresca la cache del AI, pero le decimos al AI que hizo un refresh general
      const res = await fetchJson(`${GATEWAY}/ai/insights/refresh`, { method: 'POST' });
      return { success: true, message: "Caché limpia. El próximo análisis será forzado.", res };
    }

    case 'generate_daily_report_email': {
      const today = new Date().toISOString().split('T')[0];
      const settlement = await fetchJson(`${GATEWAY}/orders/settlement/daily?date=${today}`);
      if (settlement.error) return settlement;
      
      // Simulamos la llamada a una notificación (ej: trigger a RabbitMQ o Redis si existiera un endpoint)
      // En este caso, simplemente retornamos un mensaje de éxito con el contenido que el bot puede confirmar
      return {
        success: true,
        sent_to: "admin@kiora.com",
        subject: `Reporte Kiora: ${today}`,
        data: settlement
      };
    }

    case 'send_supplier_email': {
      console.log(`[Tool] Simulando envío de email a ${args.supplier_email}`);
      console.log(`[Tool] Asunto: ${args.subject}`);
      return { success: true, message: `Correo enviado exitosamente a ${args.supplier_email}` };
    }

    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

module.exports = { TOOLS, executeTool };
