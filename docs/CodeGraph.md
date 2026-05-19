---
title: "Grafo de Dependencias del Código"
tags: [graphify, architecture, codebase]
---
[[Home]] > **Code Graph**

# Knowledge Graph del Código

*Última ejecución:* 2026-05-16 23:30 UTC

## Mapa de Servicios

```
                    ┌──────────────────┐
                    │   API Gateway     │ (:3000)
                    └────────┬─────────┘
         ┌───────────────────┼───────────────────┐
         │        │         │         │         │
         ▼        ▼         ▼         ▼         ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │ Users  │ │Products│ │Inventory│ │ Orders │ │Reports │
   │:3001   │ │:3002   │ │:3003   │ │:3004   │ │:3006   │
   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
                                                   ▲
   ┌──────────────┐                               │
   │Notifications │(:3005) ────────────────────────┘
   └──────────────┘  (Redis Streams)
```

## Dependencias entre Servicios

| Servicio | Depende de | Propósito |
|----------|-----------|-----------|
| `api-gateway` | users, products, inventory, orders, notifications, reports | Enruta tráfico, auth centralizado, rate-limiting |
| `orders-service` | inventory (`saga/reserve`), reports (broadcast) | Valida stock antes de cobrar, outbox events |
| `inventory-service` | products | Consulta productos para movimientos |
| `reports-service` | orders | Genera reportes desde datos de órdenes |
| `notifications-service` | — (Redis Streams) | Escucha eventos via pub/sub |

## Stack Tecnológico

- **Runtime:** Node.js 20 (Express.js)
- **Base de datos:** PostgreSQL por servicio + Redis (sesiones, caché, rate-limit)
- **Mensajería:** Outbox pattern (tabla `outbox_events`) + Redis Streams
- **Observabilidad:** OpenTelemetry (Jaeger), Prometheus, Grafana
- **Facturación:** Stripe (pagos), Factus/DIAN (facturación electrónica)
- **Frontend:** Astro + React (TypeScript), Nginx, PWA
- **Infra:** Docker Compose, Azure VM (Ubuntu 22.04)

## Archivos de la Bóveda

- [[Home]] — Inicio
- [[INTER_SERVICE_CONTRACTS]] — Contratos HTTP entre servicios
- [[DEGRADATION_MATRIX]] — Degradación y fallos
- [[PRODUCTION_READINESS]] — Estado producción
- [[Arquitectura_Datos]] — Modelo de datos (ERD)
- [[SECRETS_INVENTORY]] — Variables de entorno
- [[AZURE_VM_DEPLOYMENT]] — Deploy en Azure
