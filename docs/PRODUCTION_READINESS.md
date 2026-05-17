---
title: "Roadmap y Estado de Producción"
tags: [roadmap, produccion, arquitectura]
---
[[Home]] > **Roadmap de Producción**

# Roadmap y Estado de Producción (Kiora)

Este documento es una guía interna para alinear las expectativas entre Ingeniería, Producto y Ventas sobre qué componentes del backend están listos para entornos productivos reales y cuáles requieren más iteraciones.

---

## 🟢 Production-Ready (Listos para uso crítico)

Los siguientes componentes cuentan con alta cobertura de tests, manejo de errores robusto, seguridad auditada, observabilidad unificada (Winston JSON + métricas) y transacciones atómicas garantizadas.

*   **Autenticación y Seguridad (`users-service`)**
    *   JWT stateless con revocación basada en listas negras (Redis).
    *   Gestión de contraseñas, recuperación por código seguro, protección contra ataques de fuerza bruta (Rate Limiting).
*   **API Gateway y Perímetro**
    *   Rate limiting global soportado por Redis (con fallback *fail-open*).
    *   Generación de `x-correlation-id` inyectado por toda la pila (AsyncLocalStorage).
*   **Consistencia Distribuida (Sagas / Outbox Pattern)**
    *   El flujo Venta -> Inventario está garantizado mediante Eventos en `orders-service` y un *Poller* resiliente con lógica de reintentos exponenciales + Jitter (Fase 5).
    *   Compensación automática de negocio (cancelaciones y reembolsos automáticos en Stripe por falta de stock).
*   **Gestión de Inventario (`inventory-service`)**
    *   Movimientos de entrada y salida consistentes (soportando concurrencia transaccional en PostgreSQL).

---

## 🟡 Beta / MVP (Estables, pero con deuda técnica conocida)

Componentes funcionales y utilizables en producción con bajo tráfico, pero que están mapeados para refactorizaciones futuras de rendimiento o mantenibilidad.

*   **Catálogo de Productos (`products-service`)**
    *   Funciona correctamente, pero arrastra una versión de dependencias legacy de imágenes (`multer-storage-cloudinary`).
    *   *Roadmap:* Migrar flujo de subida de imágenes a *Pre-signed URLs* (S3 o compatible) para no saturar el servicio Node.js con buffers de imágenes.
*   **Notificaciones (`notifications-service`)**
    *   El encolamiento por Redis Streams es confiable, pero las plantillas actuales de email son muy básicas.
*   **Pagos (Stripe Webhooks)**
    *   Implementado y validado de extremo a extremo, pero en fase MVP. Todavía puede añadirse soporte a métodos de pago alternativos (Apple Pay, Google Pay).

---

## 🔴 Experimental (Evitar en Misión Crítica)

*   **Exportación de Reportes Grandes (`reports-service`)**
    *   Utiliza streams (PDFKit, ExcelJS), lo cual protege la RAM, pero `exceljs` arrastra advertencias de seguridad menores (`uuid` legacy) no aptas para entornos con cumplimiento ISO estricto.
*   **WebSockets en API Gateway**
    *   El *Dashboard Stats* se transmite por Socket.IO usando un hook del backend, pero actualmente corre en una sola instancia.
    *   *Roadmap:* Para escalar el API Gateway horizontalmente (múltiples pods), será obligatorio implementar un `socket.io-redis-adapter`.

---

## Métricas de Cumplimiento de la Auditoría

Tras completar las **Fases 0 a 7** de la auditoría arquitectónica, se ha cumplido el siguiente criterio de hecho (*Definition of Done*):

- [x] **CI Verde en todo el monorepo:** Migraciones y tests se ejecutan siempre antes de cualquier merge a `main`.
- [x] **Observabilidad:** Logs correlacionados en formato JSON y métricas de latencia de Prometheus (`p95`).
- [x] **Documentación y Contratos:** Todos los servicios tienen especificaciones OpenAPI verificadas mediante Tests de Contratos.
- [x] **Seguridad de Secretos:** `.env` extraídos fuera del repositorio fuente e inyección robusta por `docker-compose`.
- [x] **Consistencia Eventual Lidiada:** Sustitución de HTTP Síncrono por patrón Outbox asíncrono para operaciones multi-base de datos.

---

## 🏗️ Estado de la Infraestructura y Cloud

El despliegue ha transicionado a un modelo de control completo mediante **Máquina Virtual (IaaS)** en Microsoft Azure, superando las restricciones de capa gratuita de servicios PaaS o Serverless.

- **Orquestación:** Un solo nodo con Docker Compose (`Standard_D2s_v3`, 8GB RAM). 
- **Bases de datos:** Contenedores aislados de PostgreSQL y Redis integrados en la red privada de Docker, reduciendo drásticamente latencias y costos de nube administrada.
- **Migraciones:** Completamente automáticas vía `entrypoint.sh` en el arranque.

### 🔮 Roadmap de Operaciones (Ops)
1. **Adquisición de Dominio y Caddy:** Para alcanzar nivel *Enterprise-Grade*, se deberá adquirir un nombre de dominio (DNS) e instalar **Caddy** como *Reverse Proxy* en la VM para delegar la obtención y rotación automática de certificados SSL/HTTPS.
2. **Rehabilitación de CSP:** Una vez desplegado Caddy con HTTPS nativo, se reactivará `Content-Security-Policy` completo en Helmet dentro del `api-gateway`.
