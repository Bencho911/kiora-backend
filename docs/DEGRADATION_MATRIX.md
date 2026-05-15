---
title: "Matriz de Degradación"
tags: [resiliencia, operaciones, arquitectura]
---
[[Home]] > **Matriz de Degradación**

# Matriz de Resiliencia y Degradación (Kiora Backend)

El backend de Kiora opera bajo una arquitectura de microservicios distribuidos. Para asegurar la continuidad del negocio (evitar que el kiosco deje de vender por el fallo de un componente no crítico), se han implementado patrones de resiliencia (Outbox, circuit breakers, fail-open).

Esta matriz está diseñada para los equipos de Operaciones y Soporte, indicando qué impacto tiene la caída de cada servicio sobre la funcionalidad general del sistema y qué comportamiento esperar en el cliente/cajero.

---

## Matriz "Funcionalidad × Dependencia"

| Microservicio Caído | Impacto en el Negocio | Comportamiento en Kiosco / Cajero | Resolución / Recuperación Automática |
| :--- | :--- | :--- | :--- |
| **`inventory-service`** | 🟡 Medio | **Las ventas continúan funcionando.** Se mostrará un aviso de *"sincronización pendiente"*. No se podrá ver el stock real actualizado. | El Outbox Poller en `orders-service` guarda los eventos. Cuando el inventario vuelva, se descontará el stock de golpe. Si hay quiebre de stock, se lanza una compensación automática. |
| **`products-service`** | 🔴 Alto (Lecturas) | Las búsquedas del catálogo pueden volverse lentas o fallar si PostgreSQL y Redis caen simultáneamente. | El API Gateway implementa timeouts. Sin catálogo, no se pueden añadir productos al carrito mediante búsqueda (sólo escáner si está cacheado en el cliente). |
| **`orders-service`** | 🔴 Crítico | No se pueden registrar ventas nuevas ni emitir facturas. El kiosco entra en "Modo Offline" estricto. | Sin fallback en backend. Requiere recuperación inmediata del contenedor/BD de órdenes. |
| **`users-service`** | 🔴 Crítico (Logins) | Los usuarios existentes con un token JWT válido (y no revocado en Redis) **pueden seguir operando**. No se permiten nuevos inicios de sesión. | La validación del JWT es stateless. La caída solo afecta al inicio de sesión y recuperación de contraseña. |
| **`api-gateway`** | 🔴 Crítico (Total) | Falla toda la comunicación frontend-backend. El kiosco no se puede comunicar. | Requiere reiniciar el Gateway. |
| **`notifications-service`** | 🟢 Bajo | No afecta en absoluto la venta ni el flujo operativo. Los emails no se enviarán. | Los mensajes quedan encolados de manera segura en **Redis Streams**. Cuando el servicio levante, procesará el *backlog* de emails atrasados. |
| **`reports-service`** | 🟢 Bajo | No afecta ventas. Los reportes de Excel/PDF no se podrán descargar temporalmente. | Recuperación manual. Reintentar descarga en el panel admin. |
| **Redis Cache** | 🟢 Bajo | Las búsquedas y el Rate Limiter operan en modo *fail-open* (dejan pasar el tráfico). Ligeramente más lentitud en catálogo. | El sistema sobrevive sin caché. Las bases de datos absorberán toda la carga de lectura. |
| **Stripe (API Caída)** | 🟡 Medio | Las ventas con tarjeta de crédito no procesarán. | Desactivar el botón de pago por tarjeta temporalmente y aceptar efectivo. |

---

## Flujos de Compensación (Sagas Automáticas)

Gracias a la implementación del **Outbox Pattern** (Fase 5), algunos errores lógicos o caídas de red tienen recuperación automática sin intervención humana:

1. **Rechazo de Inventario:** Si un usuario compra un producto, pero al intentar sincronizar el inventario el backend detecta que ya no hay stock (Error 409), el sistema **automáticamente**:
   - Cambia el estado de la venta a `cancelada`.
   - Si hubo pago por tarjeta, inicia un proceso automático de **Reembolso en Stripe**.
   - Notifica por WebSocket al administrador que hubo una venta compensada.

2. **Webhooks Demorados:** Si Stripe cobra pero el Webhook tarda en llegar a Kiora, el estado del pedido quedará como `pendiente_pago` hasta que llegue. La conciliación es eventual.

---

> **Para Soporte Nivel 1:** Si un cajero reporta "Kiosco lento" pero puede vender, **probablemente el catálogo o inventario estén caídos**. Indique al cajero que puede seguir vendiendo mientras Operaciones reinicia los servicios afectados.
