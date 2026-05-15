---
title: "Contratos Inter-servicio"
tags: [arquitectura, contratos, backend]
---
[[Home]] > **Contratos Inter-servicio**

# Contratos entre microservicios (Kiora)

Referencias HTTP entre servicios. **No hay FK entre bases de datos**; la consistencia es por aplicación.

## Variables de entorno (URLs base)

| Cliente | Variable | Destino por defecto |
|---------|----------|---------------------|
| **inventory-service** → products | `PRODUCTS_SERVICE_URL` | `http://localhost:3002` |
| **orders-service** → inventory | `INVENTORY_SERVICE_URL` | `http://localhost:3003` |
| **orders-service** → gateway | `API_GATEWAY_URL` | `http://localhost:3000` |

En Docker Compose los valores suelen ser nombres de servicio (`http://products-service:3002`, etc.).

---

## Tabla de contratos

Cada llamada inter-servicio tiene un contrato explícito con timeout, política de reintentos y comportamiento ante errores:

| Origen → Destino | Método | Ruta | Timeout | Retry | Modo | 2xx | 4xx | 5xx / Red |
|---|---|---|---|---|---|---|---|---|
| orders → inventory | `POST` | `/api/inventory/movements` | 5 s | 5× backoff + jitter | **Async (Outbox)** | Movimiento creado | 409 → compensación automática (cancelar orden + reembolso Stripe) | Reintentar; si agota → DLQ |
| orders → inventory | `POST` | `/api/inventory/saga/reserve` | 5 s | 0 (falla al usuario) | **Síncrono** | Reserva temporal OK | 409 → stock agotado → informar usuario | 503 → error genérico al usuario |
| orders → inventory | `POST` | `/api/inventory/saga/reserve/commit` | 5 s | 5× backoff + jitter | **Async (Outbox)** | Commit de reserva permanente | — | Reintentar; si agota → DLQ |
| orders → gateway | `POST` | `/api/internal/broadcast` | 3 s | 1 intento (fire & forget) | Síncrono | WebSocket emitido al dashboard | — | Solo log (no bloquea la venta) |
| inventory → products | `PUT` | `/api/products/:cod_prod/stock` | 5 s | 3× backoff + jitter (via circuit breaker) | Síncrono | Stock actualizado en catálogo | 409 → stock insuficiente, break loop | Log error, marcar como "no sincronizado" |

---

## Política general de comunicación

### Timeouts
- **5 segundos** para llamadas de escritura (movimientos de inventario, reservas, sincronización de stock).
- **3 segundos** para notificaciones (broadcast WebSocket al dashboard).
- Implementados con `AbortController` nativo de Node.js en cada `fetch`.

### Ante errores HTTP 4xx (400, 409, 422)
- Error de negocio → **NO reintentar**.
- Retornar el error al caller inmediatamente.
- Excepción: `429 Too Many Requests` → respetar header `Retry-After` si existe.

### Ante errores HTTP 5xx o timeout de red
- **Reintentar** con backoff exponencial + jitter.
- Fórmula de delay: `baseDelay × 2^(attempt-1) × (0.5 + random())`.
- Base delay: **500 ms**, máximo **3 intentos** (total ~3.5 s de espera).
- Si se agotan los reintentos: log de error + la acción del servicio que llamó sigue su política (compensación, DLQ, etc.).

### Propagación de headers
- `x-correlation-id`: se propaga en **todas** las llamadas inter-servicio para trazabilidad distribuida.
- `Authorization`: se propaga cuando la llamada requiere permisos del usuario original.

---

## Trazabilidad

- El **API Gateway** genera o reenvía `x-correlation-id` (también acepta `x-request-id` del cliente) y lo inyecta en las peticiones proxificadas.
- Los controladores de **inventory** y **orders** reenvían `x-correlation-id` en las llamadas `fetch` salientes cuando está presente.

---

## Resiliencia

### Circuit Breaker (opossum)
- Usado en `orders-service → inventory-service` y `inventory-service → products-service`.
- Configuración: umbral de error 50%, timeout 2s (opossum), ventana de reset 30s.
- Fallback: lanza error con código `CIRCUIT_OPEN` para que el caller decida qué hacer.

### Cliente HTTP compartido (`httpClient.js`)
- Módulo `src/utils/httpClient.js` con API unificada en `orders-service` e `inventory-service`.
- Funciones: `outgoingHeaders()` y `fetchWithRetry()`.
- `fetchWithRetry` acepta `timeoutMs` (default 5000) para abortar peticiones lentas.

---

## Stock: fuente de verdad

- **products-service** mantiene `stock_actual` y `stock_minimo` en el catálogo (consulta HU / alertas de bajo stock).
- **inventory-service** registra movimientos históricos y, tras cada movimiento, **sincroniza** el catálogo vía HTTP.  
- La verdad operativa del número mostrado al cliente en catálogo es el **producto**; el inventario es auditoría + motor de movimientos.

---

## Versiones de Express (nota)

- **api-gateway** usa Express 4.x; varios microservicios usan Express 5.x. Unificación es posible pero no bloquea el contrato HTTP; documentado para evitar sorpresas al depurar middleware.
