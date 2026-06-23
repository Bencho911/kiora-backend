---
title: "Kiora Backend Root"
tags: [root, kiora, backend]
---

# Kiora Backend 🚀

> 🌌 **Obsidian Vault:** Este repositorio está configurado como una Bóveda de Obsidian. Comienza la navegación por la documentación en [[Home]].

Sistema de **microservicios** en Node.js para el kiosco inteligente Kiora.

**Contribuir:** [CONTRIBUTING.md](CONTRIBUTING.md) — Definition of Done, PRs y gobernanza de secretos ([docs/SECRETS_INVENTORY.md](docs/SECRETS_INVENTORY.md)).

---

## Arquitectura

```
kiora-backend/
├── services/
│   ├── api-gateway/            # Punto de entrada único — proxy + Swagger agregado (puerto 3000)
│   ├── users-service/          # Autenticación y gestión de usuarios (puerto 3001)
│   ├── products-service/       # Catálogo de productos y categorías (puerto 3002)
│   ├── inventory-service/      # Stock, movimientos e inventario de proveedores (puerto 3003)
│   ├── orders-service/         # Ventas y facturación (puerto 3004)
│   ├── notifications-service/  # Emails vía Redis Streams / Consumer Groups (puerto 3005)
│   └── reports-service/        # Emisión PDFKit asíncrona de reportes y facturas (puerto 3006)
├── database/
│   └── kiora_schema.sql        # Referencia global del esquema (documentación)
├── docs/
│   └── INTER_SERVICE_CONTRACTS.md  # URLs, trazabilidad y dueño del stock entre servicios
└── docker-compose.yml          # Infraestructura local completa
```

Cada servicio es **autónomo**: tiene su propia base de datos, migraciones, Dockerfile y configuración de entorno. Las referencias cruzadas entre servicios se manejan mediante **llamadas HTTP** (sin FK de BD entre dominios).

### API Gateway (puerto 3000)

Entrada recomendada para el front: proxifica `/api/auth`, `/api/users`, `/api/products`, `/api/categories`, `/api/inventory`, `/api/orders`, `/api/invoices`, `/api/notifications` hacia cada microservicio. Expone `GET /health`, `GET /health/all` y Swagger unificado en `/api/docs`. Variables: `USERS_SERVICE_URL`, `PRODUCTS_SERVICE_URL`, `INVENTORY_SERVICE_URL`, `ORDERS_SERVICE_URL`, `NOTIFICATIONS_SERVICE_URL`, `PORT`, `CORS_ORIGIN`. Local: `cd services/api-gateway && npm install && npm run dev`.

3. Genera o respeta **`x-correlation-id`** (también acepta **`x-request-id`** del cliente) y lo reenvía a los servicios detrás del proxy.

### 📚 Documentación de Arquitectura y Resiliencia

El backend está diseñado para soportar fallos parciales sin interrumpir el negocio. Consulta los siguientes documentos de diseño:

- 📄 **[Contratos e Integración (Síncrona y Asíncrona)](docs/INTER_SERVICE_CONTRACTS.md)**: URLs, responsabilidades y comunicación HTTP/Outbox entre servicios.
- 🛡️ **[Matriz de Degradación (Operaciones)](docs/DEGRADATION_MATRIX.md)**: Guía de qué ocurre cuando un microservicio cae y cómo el sistema se recupera (sagas/compensaciones automáticas).
- 🚀 **[Estado de Producción y Roadmap](docs/PRODUCTION_READINESS.md)**: Nivel de madurez técnica de cada servicio (Production-Ready, Beta, Experimental).
- 🔑 **[Inventario de Secretos](docs/SECRETS_INVENTORY.md)**: Gobernanza de variables de entorno y credenciales sensibles.

---

## Levantar el entorno local

Sigue estos pasos para configurar y ejecutar el proyecto:

1. **Configuración inicial**: Genera los archivos de entorno básicos.
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```
   *Nota: Las variables vitales (como `DATABASE_URL`) ahora se inyectan automáticamente a través de `docker-compose.yml`, lo que asegura que las bases de datos y migraciones funcionen sin problemas, incluso si omites pasos en la configuración local.*

2. **Iniciar infraestructura**:
   ```bash
   docker compose up -d
   ```

| Servicio               | URL / Puerto        | Base de datos  |
|------------------------|---------------------|----------------|
| api-gateway            | `localhost:3000`    | —              |
| users-service          | `localhost:3001`    | `kiora_users` @ 5433   |
| products-service       | `localhost:3002`    | `kiora_products` @ 5434 |
| inventory-service      | `localhost:3003`    | `kiora_inventory` @ 5435 |
| orders-service         | `localhost:3004`    | `kiora_orders` @ 5436  |
| notifications-service  | `localhost:3005`    | Sin BD (Redis + SMTP)  |
| reports-service        | `localhost:3006`    | Sin BD (PDFKit Stream) |
| Redis                  | `localhost:6379`    | —              |
| pgAdmin                | `localhost:5050`    | —              |

---

## Stack de Observabilidad
El clúster implementa monitoreo en tiempo real recolectando métricas e instrumentando las transacciones vía OTLP:
- **Prometheus**: Reúne métricas nativas en `/metrics`.
- **Grafana**: Sirve los dashboards visuales aprovisionados.
- **OpenTelemetry / Jaeger**: Tracing distribuido propagado en transacciones y Redis.

---

## Servicios

### 🔐 users-service

Gestión de usuarios, autenticación JWT y recuperación de contraseña.

- **BD:** `kiora_users` (PostgreSQL @ `localhost:5433`)
- **Docs:** [`services/users-service/README.md`](services/users-service/README.md)
- **Swagger:** `http://localhost:3001/api/docs`
- **Tests:** 54 tests de integración (`npm test`)

### 📦 products-service

Catálogo de productos: crear, consultar y administrar productos y categorías.

- **BD:** `kiora_products` (PostgreSQL @ `localhost:5434`)
- **Swagger:** `http://localhost:3002/api/docs`
- **Tablas:** `Categoria`, `Producto`

### 🏭 inventory-service

Control de stock: movimientos de entrada/salida, proveedores y stock disponible.

- **BD:** `kiora_inventory` (PostgreSQL @ `localhost:5435`)
- **Swagger:** `http://localhost:3003/api/docs`
- **Tablas:** `Proveedor`, `Inventario`, `Suministra`
- Consulta a `products-service` via HTTP para validar productos.

### 📋 orders-service

Ventas y facturación: crear ordenes, detalles de productos vendidos y facturas.

- **BD:** `kiora_orders` (PostgreSQL @ `localhost:5436`)
- **Swagger:** `http://localhost:3004/api/docs`
- **Tablas:** `Ventas`, `Producto_Venta`, `Factura`
- Consulta a `users-service` e `inventory-service` via HTTP.

### 🔔 notifications-service

Envío centralizado de emails y alertas proactivas.

- **Sin BD propia** — consume eventos de Redis Streams mediante **Consumer Groups** garantizando encolamiento resistente a caídas.
- Para enviar un email desde cualquier servicio, se inyecta el payload a `notifications_stream` usando `XADD` (Ej. Stock bajo o cron caducidad).

### 📄 reports-service

Microservicio aislado y de alto rendimiento dedicado a exportar facturas PDF con el detalle de las Ventas. Usando streams y buffers directamente sobre HTTP para no consumir memoria. Usa `pdfkit`.
- **Swagger:** `http://localhost:3006/api/docs`

---

## Migraciones

Cada servicio maneja sus propias migraciones con `node-pg-migrate`:

```bash
# Desde el directorio del servicio
npm run migrate:up        # Aplica migraciones pendientes (local)
npm run migrate:up:docker # Aplica migraciones en contenedor Docker
```

---

## CI/CD

**GitHub Actions** en cada push/PR a `main` o `develop`: validación de **`docker compose config`** (en CI con stubs vacíos de `.env.docker`, que no están en git), users-service (lint, audit high, tests, migraciones), products-service (lint, audit high, tests, migraciones), inventory-service, orders-service, notifications-service y reports-service (lint, audit high, tests), api-gateway (lint, audit high, tests). Ver [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Lista de checks para branch protection: [CONTRIBUTING.md](CONTRIBUTING.md).

> **reports-service:** `npm audit` puede listar hallazgos **moderate** en la cadena **exceljs → uuid**; `audit:ci` usa `--audit-level=high` como en el resto de servicios. Cuando **exceljs** (o un sustituto) permita **uuid** parcheado sin romper CommonJS/Jest, conviene revisar de nuevo.

---
