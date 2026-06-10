import os
import httpx
import logging

GATEWAY = os.getenv("API_GATEWAY_URL", "http://localhost:3000/api")
API_KEY = os.getenv("API_KEY", "")
FETCH_TIMEOUT = 5.0

logger = logging.getLogger(__name__)

async def fetch_json(url: str):
    try:
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT) as client:
            response = await client.get(url, headers={"x-api-key": API_KEY})
            if response.status_code != 200:
                return None
            
            data = response.json()
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data
    except Exception as e:
        logger.error(f"[ContextBuilder] Error fetching {url}: {e}")
        return None

def format_currency(n: float) -> str:
    if n is None:
        n = 0
    # A simple COP formatter
    return f"${int(float(n)):,} COP".replace(",", ".")

async def build_system_context() -> str:
    parts = []

    # 1. Stats del dashboard
    stats = await fetch_json(f"{GATEWAY}/dashboard/stats")
    if stats:
        parts.append("--- DATOS DEL DASHBOARD ---")
        ventas_hoy = stats.get("ventas_hoy", stats.get("ventasHoy", "N/A"))
        monto_total = stats.get("monto_total", stats.get("totalHoy", 0))
        parts.append(f"Ventas hoy: {ventas_hoy} (total: {format_currency(monto_total)})")
        
        ticket_prom = stats.get("ticket_promedio", stats.get("ticketPromedio", 0))
        parts.append(f"Ticket promedio: {format_currency(ticket_prom)}")
        
        ultima_venta = stats.get("ultima_venta", {})
        monto_ultima = ultima_venta.get("montofinal_vent", 0)
        metodo_ultima = ultima_venta.get("metodopago_usu", "N/A")
        parts.append(f"Última venta: {format_currency(monto_ultima)} ({metodo_ultima})")
        
        parts.append(f"Total ventas hoy: {ventas_hoy}")

    # 2. Productos con stock bajo
    low_stock = await fetch_json(f"{GATEWAY}/products/low-stock")
    suministros = await fetch_json(f"{GATEWAY}/inventory/suministra?limit=1000")
    
    # Map suministros by cod_prod
    suministra_map = {}
    if isinstance(suministros, list):
        for s in suministros:
            # handle 'data' wrap if present
            pass
    # Depending on how parsePagination formats output, suministros could be a dict with 'data'
    if isinstance(suministros, dict) and "data" in suministros:
        suministra_list = suministros["data"]
    elif isinstance(suministros, list):
        suministra_list = suministros
    else:
        suministra_list = []
        
    for s in suministra_list:
        cod_prod = s.get("cod_prod")
        if cod_prod is not None:
            suministra_map[str(cod_prod)] = s

    if isinstance(low_stock, list) and len(low_stock) > 0:
        parts.append(f"\n--- PRODUCTOS CON STOCK BAJO ({len(low_stock)}) ---")
        for p in low_stock[:10]:
            cod_prod = p.get("cod_prod")
            name = p.get("nom_prod", p.get("name", "Desconocido"))
            stock = p.get("stock_actual", p.get("stock", 0))
            min_stock = p.get("stock_minimo", p.get("minStock", 0))
            
            # Buscar proveedor
            prov_str = ""
            sup = suministra_map.get(str(cod_prod)) if cod_prod is not None else None
            if sup:
                nom_prov = sup.get("nom_prov", "Desconocido")
                correo_prov = sup.get("correo_prov", "Sin correo")
                prov_str = f" (Proveedor: {nom_prov}, Correo: {correo_prov})"
                
            parts.append(f"- {name}: {stock} unidades (mínimo: {min_stock}){prov_str}")

    # 3. Categorías disponibles
    categories = await fetch_json(f"{GATEWAY}/categories")
    if isinstance(categories, list) and len(categories) > 0:
        parts.append(f"\n--- CATEGORÍAS ({len(categories)}) ---")
        cat_names = [c.get("nom_cat", c.get("name", "")) for c in categories]
        parts.append(", ".join(cat_names))

    return "\n".join(parts)
