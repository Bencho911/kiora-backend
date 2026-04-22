# Kiora Backend 🚀

Sistema de **microservicios** en Node.js para el kiosco inteligente Kiora.

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
│   └── notifications-service/  # Emails vía Redis pub/sub (puerto 3005)
├── database/
│   └── kiora_schema.sql        # Referencia global del esquema (documentación)
├── docs/
│   └── INTER_SERVICE_CONTRACTS.md  # URLs, trazabilidad y dueño del stock entre servicios
└── docker-compose.yml          # Infraestructura local completa
```

Cada servicio es **autónomo**: tiene su propia base de datos, migraciones, Dockerfile y configuración de entorno. Las referencias cruzadas entre servicios se manejan mediante **llamadas HTTP** (sin FK de BD entre dominios).

### API Gateway (puerto 3000)

Entrada recomendada para el front: proxifica `/api/auth`, `/api/users`, `/api/products`, `/api/categories`, `/api/inventory`, `/api/orders`, `/api/invoices`, `/api/notifications` hacia cada microservicio. Expone `GET /health`, `GET /health/all` y Swagger unificado en `/api/docs`. Variables: `USERS_SERVICE_URL`, `PRODUCTS_SERVICE_URL`, `INVENTORY_SERVICE_URL`, `ORDERS_SERVICE_URL`, `NOTIFICATIONS_SERVICE_URL`, `PORT`, `CORS_ORIGIN`. Local: `cd services/api-gateway && npm install && npm run dev`.

Genera o respeta **`x-correlation-id`** (también acepta **`x-request-id`** del cliente) y lo reenvía a los servicios detrás del proxy.

Contratos HTTP entre servicios: [docs/INTER_SERVICE_CONTRACTS.md](docs/INTER_SERVICE_CONTRACTS.md).

---

## Levantar el entorno local

Sigue estos pasos para configurar y ejecutar el proyecto:

1. **Configuración inicial**: Crea los archivos de entorno para todos los servicios.
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```
   *Nota: Revisa los archivos `.env.docker` generados en cada carpeta de servicio para asegurarte de que los secretos (JWT, SMTP) estén configurados si es necesario.*

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
| Redis                  | `localhost:6379`    | —              |
| pgAdmin                | `localhost:5050`    | —              |

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
- **Tablas:** `Categoria`, `Producto`

### 🏭 inventory-service

Control de stock: movimientos de entrada/salida, proveedores y stock disponible.

- **BD:** `kiora_inventory` (PostgreSQL @ `localhost:5435`)
- **Tablas:** `Proveedor`, `Inventario`, `Suministra`
- Consulta a `products-service` via HTTP para validar productos.

### 📋 orders-service

Ventas y facturación: crear ordenes, detalles de productos vendidos y facturas.

- **BD:** `kiora_orders` (PostgreSQL @ `localhost:5436`)
- **Tablas:** `Ventas`, `Producto_Venta`, `Factura`
- Consulta a `users-service` e `inventory-service` via HTTP.

### 🔔 notifications-service

Envío centralizado de emails.

- **Sin BD propia** — consume eventos del canal Redis `kiora:notifications`.
- Para enviar un email desde cualquier servicio, publicar en Redis:
  ```js
  redisClient.publish('kiora:notifications', JSON.stringify({
    to: 'usuario@example.com',
    subject: 'Asunto',
    html: '<p>Cuerpo HTML</p>',
  }));
  ```

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

**GitHub Actions** en cada push/PR a `main` o `develop`: users-service (lint, audit high, tests, migraciones), products-service (lint, audit critical, tests, migraciones), inventory-service y orders-service (lint, audit high, tests), api-gateway (lint, audit high, tests). Ver [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

> **products-service:** `audit:ci` usa `--audit-level=critical` porque dependencias transitivas (p. ej. Cloudinary v1) reportan *high* hasta una actualización mayor planificada.