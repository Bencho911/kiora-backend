import os
import httpx
from datetime import datetime

GATEWAY = os.getenv("API_GATEWAY_URL", "http://localhost:3000/api")
API_KEY = os.getenv("API_KEY", "")
FETCH_TIMEOUT = 5.0

async def fetch_json(url: str, method: str = "GET", body: dict = None):
    try:
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT) as client:
            headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}
            if method == "GET":
                response = await client.get(url, headers=headers)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=body)
            elif method == "PUT":
                response = await client.put(url, headers=headers, json=body)
            else:
                return {"error": f"Method {method} not supported"}

            if response.status_code == 204:
                return {"success": True}
            
            if response.status_code >= 400:
                err_text = response.text
                return {"error": f"HTTP {response.status_code}: {err_text}"}

            json_data = response.json()
            if isinstance(json_data, dict) and "data" in json_data and not json_data.get("error"):
                return json_data["data"]
            return json_data
    except Exception as e:
        return {"error": str(e)}


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_sales_summary",
            "description": "Obtener resumen de ventas para un período específico",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "enum": ["today", "yesterday", "week", "month"], "description": "Período"},
                },
                "required": ["period"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_low_stock_products",
            "description": "Obtener productos con stock bajo o crítico",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_catalog",
            "description": "Obtener el catálogo de productos (filtro por categoría o búsqueda por nombre)",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Buscar por nombre (opcional)"},
                    "category_id": {"type": "number", "description": "ID de categoría (opcional)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_service_health",
            "description": "Obtener estado de salud de todos los servicios del sistema",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_daily_settlement",
            "description": "Obtener el corte de caja del día",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Fecha en formato YYYY-MM-DD (default: hoy)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_product_stock",
            "description": "Suma o resta inventario de un producto",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "number", "description": "ID del producto"},
                    "cantidad": {"type": "number", "description": "Cantidad a sumar (positivo) o restar (negativo)"},
                },
                "required": ["id", "cantidad"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_product_price",
            "description": "Cambiar el precio unitario de un producto",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "number", "description": "ID del producto"},
                    "new_price": {"type": "number", "description": "Nuevo precio unitario"},
                },
                "required": ["id", "new_price"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_maintenance_incident",
            "description": "Crear un reporte de falla, mantenimiento o incidente",
            "parameters": {
                "type": "object",
                "properties": {
                    "titulo": {"type": "string", "description": "Título corto del incidente"},
                    "descripcion": {"type": "string", "description": "Detalle descriptivo"},
                    "prioridad": {"type": "string", "enum": ["baja", "media", "alta"], "description": "Prioridad"},
                },
                "required": ["titulo", "descripcion", "prioridad"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sales_heat_map",
            "description": "Analizar ventas recientes agrupadas por hora del día para detectar picos",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_underperforming_products",
            "description": "Obtener productos con buen stock pero pocas o ninguna venta",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "predict_stock_depletion",
            "description": "Predecir días de stock restantes basado en ventas de la última semana",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "number", "description": "ID del producto a analizar"},
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clear_system_cache",
            "description": "Limpia la memoria caché del AI y fuerza una reevaluación de los datos",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_daily_report_email",
            "description": "Envía un resumen de ventas del día por email simulado/notificación",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_sales_chart",
            "description": "Genera y envía por Telegram un gráfico de barras visual con las ventas de los últimos 7 días",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_supplier_email",
            "description": "Envía un correo electrónico a un proveedor solicitando inventario (simulado)",
            "parameters": {
                "type": "object",
                "properties": {
                    "supplier_email": {"type": "string", "description": "Correo del proveedor"},
                    "subject": {"type": "string", "description": "Asunto del correo"},
                    "body": {"type": "string", "description": "Cuerpo del mensaje"},
                },
                "required": ["supplier_email", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_product",
            "description": "Crear un nuevo producto en el catálogo (stock será 0 por defecto)",
            "parameters": {
                "type": "object",
                "properties": {
                    "nom_prod": {"type": "string", "description": "Nombre del producto"},
                    "precio_unitario": {"type": "number", "description": "Precio unitario (venta)"},
                    "stock_minimo": {"type": "number", "description": "Límite mínimo para alertas"},
                    "fk_cod_cats": {"type": "array", "items": {"type": "number"}, "description": "Array con IDs de categorías (ej. [1])"}
                },
                "required": ["nom_prod", "precio_unitario", "stock_minimo", "fk_cod_cats"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_product_full",
            "description": "Actualizar propiedades generales de un producto en el catálogo",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "number", "description": "ID del producto"},
                    "nom_prod": {"type": "string"},
                    "descrip_prod": {"type": "string"},
                    "precio_unitario": {"type": "number"},
                    "descuento": {"type": "number"},
                    "codigo_barras": {"type": "string"}
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_inventory_movement",
            "description": "Registra una entrada (lote) o salida de inventario con fecha de vencimiento",
            "parameters": {
                "type": "object",
                "properties": {
                    "cod_prod": {"type": "number", "description": "ID del producto"},
                    "tipo_mov": {"type": "string", "enum": ["entrada", "salida", "ajuste"]},
                    "cantidad": {"type": "number", "description": "Cantidad a registrar"},
                    "fecha_vencimiento": {"type": "string", "description": "Fecha de caducidad del lote (YYYY-MM-DD)"},
                    "desc_mov": {"type": "string", "description": "Justificación o detalle del movimiento (ej. Lote de agosto)"}
                },
                "required": ["cod_prod", "tipo_mov", "cantidad", "desc_mov"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_basket_cross_selling",
            "description": "Analiza las ventas históricas para descubrir patrones y recomendar combos (Market Basket Analysis)",
            "parameters": {"type": "object", "properties": {}},
        },
    }
]


async def execute_tool(name: str, args: dict):
    if name == "get_sales_summary":
        period = args.get("period")
        endpoint = "/dashboard/stats" if period == "today" else f"/orders?period={period}"
        data = await fetch_json(f"{GATEWAY}{endpoint}")
        if isinstance(data, dict) and "error" in data:
            return data
        return {"period": period, "data": data}

    elif name == "get_low_stock_products":
        data = await fetch_json(f"{GATEWAY}/products/low-stock")
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "error" in data:
            return data
        return []

    elif name == "get_product_catalog":
        search = args.get("search")
        cat_id = args.get("category_id")
        url = f"{GATEWAY}/products"
        query = []
        if search:
            query.append(f"search={search}")
        if cat_id:
            query.append(f"category={cat_id}")
        if query:
            url += "?" + "&".join(query)
        data = await fetch_json(url)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "error" in data:
            return data
        return []

    elif name == "get_service_health":
        # /health/all is at the root api level, so remove /api
        base = GATEWAY.replace("/api", "")
        data = await fetch_json(f"{base}/health/all")
        return data if data else {"error": "No se pudo obtener health check"}

    elif name == "get_daily_settlement":
        date = args.get("date", datetime.now().strftime("%Y-%m-%d"))
        data = await fetch_json(f"{GATEWAY}/orders/settlement/daily?date={date}")
        return data if data else {"date": date, "message": "No hay datos para esta fecha"}

    elif name == "update_product_stock":
        return await fetch_json(
            f"{GATEWAY}/products/{args.get('id')}/stock",
            method="PUT",
            body={"cantidad": args.get("cantidad")}
        )

    elif name == "update_product_price":
        product_id = args.get("id")
        product = await fetch_json(f"{GATEWAY}/products/{product_id}")
        if isinstance(product, dict) and "error" in product:
            return product
        if not product:
            return {"error": "Producto no encontrado"}

        # Preserve other fields
        cat_code = product.get("categoria", {}).get("cod_cat")
        fk_cod_cats = [cat_code] if cat_code else []

        update_payload = {
            "nom_prod": product.get("nom_prod"),
            "precio_unitario": args.get("new_price"),
            "fk_cod_cats": fk_cod_cats,
            "stock_actual": product.get("stock_actual"),
            "stock_minimo": product.get("stock_minimo")
        }

        return await fetch_json(
            f"{GATEWAY}/products/{product_id}",
            method="PUT",
            body=update_payload
        )

    elif name == "create_maintenance_incident":
        return await fetch_json(
            f"{GATEWAY}/users/incidents",
            method="POST",
            body={
                "titulo": args.get("titulo"),
                "descripcion": args.get("descripcion"),
                "prioridad": args.get("prioridad"),
                "fk_id_usu": 1 # Default
            }
        )

    elif name == "get_sales_heat_map":
        orders = await fetch_json(f"{GATEWAY}/orders?period=week")
        if isinstance(orders, dict) and "error" in orders:
            return orders
        if not isinstance(orders, list):
            return {"error": "Formato inesperado", "data": orders}

        heat_map = {}
        for o in orders:
            try:
                date_obj = datetime.fromisoformat(o["fecha_ord"].replace('Z', '+00:00'))
                hour = f"{date_obj.hour}:00"
                heat_map[hour] = heat_map.get(hour, 0) + 1
            except Exception:
                pass
        return {"msg": "Ventas de la última semana agrupadas por hora", "heatMap": heat_map}

    elif name == "get_underperforming_products":
        stats = await fetch_json(f"{GATEWAY}/dashboard/stats")
        products = await fetch_json(f"{GATEWAY}/products")
        if (isinstance(stats, dict) and "error" in stats) or (isinstance(products, dict) and "error" in products):
            return {"error": "Error obteniendo datos"}

        top_selling = stats.get("productosMasVendidos", [])
        sales_set = {p.get("nom_prod") for p in top_selling}

        stagnant = []
        if isinstance(products, list):
            for p in products:
                if p.get("stock_actual", 0) > 10 and p.get("nom_prod") not in sales_set:
                    stagnant.append(p)
        
        items = [{"id": p.get("cod_prod"), "nombre": p.get("nom_prod"), "stock": p.get("stock_actual")} for p in stagnant[:10]]
        return {"count": len(stagnant), "items": items}

    elif name == "predict_stock_depletion":
        product_id = args.get("product_id")
        product = await fetch_json(f"{GATEWAY}/products/{product_id}")
        if isinstance(product, dict) and "error" in product:
            return {"error": "Producto no encontrado"}
        if not product or not product.get("cod_prod"):
            return {"error": "Producto no encontrado"}

        # Ahora obtenemos 1 mes entero de ventas para entrenar el modelo (antes era 1 semana)
        orders = await fetch_json(f"{GATEWAY}/orders?period=month")
        if isinstance(orders, dict) and "error" in orders:
            orders = []

        from app.services.ml_service import predict_stock_depletion_ml
        
        ml_prediction = predict_stock_depletion_ml(
            orders_data=orders,
            product_id=product_id,
            current_stock=product.get("stock_actual", 0)
        )

        return {
            "producto": product.get("nom_prod"),
            "stock_actual": product.get("stock_actual"),
            "prediccion_ml": ml_prediction
        }

    elif name == "clear_system_cache":
        res = await fetch_json(f"{GATEWAY}/ai/insights/refresh", method="POST")
        return {"success": True, "message": "Caché limpia. El próximo análisis será forzado.", "res": res}

    elif name == "generate_daily_report_email":
        today = datetime.now().strftime("%Y-%m-%d")
        settlement = await fetch_json(f"{GATEWAY}/orders/settlement/daily?date={today}")
        if isinstance(settlement, dict) and "error" in settlement:
            return settlement

        return {
            "success": True,
            "sent_to": "admin@kiora.com",
            "subject": f"Reporte Kiora: {today}",
            "data": settlement
        }

    elif name == "generate_sales_chart":
        orders = await fetch_json(f"{GATEWAY}/orders?period=week")
        if isinstance(orders, dict) and "error" in orders:
            return orders
            
        from app.services.chart_service import generate_sales_chart_base64
        from app.services.telegram_service import send_telegram_notification
        
        try:
            base64_str = generate_sales_chart_base64(orders)
            await send_telegram_notification(
                "📈 Análisis de Ventas (Gráfico)", 
                "Aquí está el gráfico de ventas de los últimos 7 días generado por la IA.", 
                photo_base64=base64_str
            )
            return {"success": True, "message": "Gráfico generado y enviado exitosamente a Telegram."}
        except Exception as e:
            return {"error": f"Error generando gráfico: {e}"}

    elif name == "send_supplier_email":
        return {"success": True, "message": f"Correo enviado exitosamente a {args.get('supplier_email')}"}

    elif name == "create_product":
        payload = {
            "nom_prod": args.get("nom_prod"),
            "precio_unitario": args.get("precio_unitario"),
            "stock_minimo": args.get("stock_minimo", 0),
            "stock_actual": 0,
            "fk_cod_cats": args.get("fk_cod_cats")
        }
        return await fetch_json(f"{GATEWAY}/products", method="POST", body=payload)
        
    elif name == "update_product_full":
        product_id = args.get("id")
        payload = {k: v for k, v in args.items() if k != "id" and v is not None}
        if not payload:
            return {"error": "No hay campos para actualizar"}
        return await fetch_json(f"{GATEWAY}/products/{product_id}", method="PUT", body=payload)

    elif name == "create_inventory_movement":
        payload = {
            "cod_prod": args.get("cod_prod"),
            "tipo_mov": args.get("tipo_mov"),
            "cantidad": args.get("cantidad"),
            "desc_mov": args.get("desc_mov")
        }
        if args.get("fecha_vencimiento"):
            payload["fecha_vencimiento"] = args.get("fecha_vencimiento")
        return await fetch_json(f"{GATEWAY}/inventory/movements", method="POST", body=payload)

    elif name == "analyze_basket_cross_selling":
        orders = await fetch_json(f"{GATEWAY}/orders?limit=300")
        products = await fetch_json(f"{GATEWAY}/products")
        
        if isinstance(orders, dict) and "error" in orders:
            return orders
        if isinstance(products, dict) and "error" in products:
            return products
            
        from app.services.ml_service import analyze_basket_cross_selling_ml
        return analyze_basket_cross_selling_ml(orders, products)

    else:
        return {"error": f"Tool desconocida: {name}"}
