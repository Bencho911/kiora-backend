# Contratos entre microservicios (Kiora)

Referencias HTTP entre servicios. **No hay FK entre bases de datos**; la consistencia es por aplicación.

## Variables de entorno (URLs base)

| Cliente | Variable | Destino por defecto |
|---------|----------|---------------------|
| **inventory-service** → products | `PRODUCTS_SERVICE_URL` | `http://localhost:3002` |
| **orders-service** → inventory | `INVENTORY_SERVICE_URL` | `http://localhost:3003` |
| **orders-service** → users (si aplica) | `USERS_SERVICE_URL` | `http://localhost:3001` |

En Docker Compose los valores suelen ser nombres de servicio (`http://products-service:3002`, etc.).

## Llamadas implementadas

1. **inventory-service** → **products-service**  
   - `PUT /api/products/:cod_prod/stock` con `{ cantidad }` (delta) tras registrar un movimiento.  
   - Reintentos con backoff; si falla todo, el movimiento ya quedó en BD de inventario y se registra error en logs (reconciliación manual o job futuro).

2. **orders-service** → **inventory-service**  
   - `POST /api/inventory/movements` al pasar una venta a estado `completada` (salida por línea).  
   - Fallos HTTP/red: se loguean; la venta puede quedar `completada` sin salida de inventario (riesgo operativo conocido).

## Trazabilidad

- El **API Gateway** genera o reenvía `x-correlation-id` (también acepta `x-request-id` del cliente) y lo inyecta en las peticiones proxificadas.
- Los controladores de **inventory** y **orders** reenvían `x-correlation-id` en las llamadas `fetch` salientes cuando está presente.

## Timeouts recomendados

- Llamadas síncronas entre servicios: **3–10 s** según red; hoy muchas rutas usan `fetch` sin `AbortController` (mejora futura).
- Ante **4xx**: tratar como error de negocio o validación; no reintentar salvo 429 con backoff.  
- Ante **5xx** o red: reintentos limitados donde ya existan (inventory → products); en otros casos log + alerta.

## Stock: fuente de verdad

- **products-service** mantiene `stock_actual` y `stock_minimo` en el catálogo (consulta HU / alertas de bajo stock).
- **inventory-service** registra movimientos históricos y, tras cada movimiento, **sincroniza** el catálogo vía HTTP.  
- La verdad operativa del número mostrado al cliente en catálogo es el **producto**; el inventario es auditoría + motor de movimientos.

## Versiones de Express (nota)

- **api-gateway** usa Express 4.x; varios microservicios usan Express 5.x. Unificación es posible pero no bloquea el contrato HTTP; documentado para evitar sorpresas al depurar middleware.
