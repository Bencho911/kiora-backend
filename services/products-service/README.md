# Kiora — Products Service

Servicio del catálogo de productos y categorías del sistema Kiora. Construido con **Node.js**, **Express** y **PostgreSQL**.

---

## Requisitos previos

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (recomendado)

---

## Levantar con Docker (recomendado)

```bash
# Desde la raíz del backend (kiora-backend/)
docker compose up -d
```

Levanta automáticamente:
- PostgreSQL (`kiora_products`) en el puerto local `5434`
- Products Service en `http://localhost:3002`

---

## Levantar manualmente

### 1. Instalar dependencias

```bash
cd kiora-backend/services/products-service
npm install
```

### 2. Configurar variables de entorno

Usa **dos archivos** para no mezclar `localhost` con nombres de servicio Docker (`products-db`):

```bash
cp .env.example .env.local
cp .env.example .env.docker
```

- **`.env.local`**: `npm run dev`, `npm run migrate:up` desde tu máquina. Usa `DB_HOST=localhost` y `DB_PORT=5434`.
- **`.env.docker`**: lo usa el contenedor `products-service`. Usa `DB_HOST=products-db` y `DB_PORT=5432`.

### 3. Crear la base de datos

Si levantas el PostgreSQL sin Docker, necesitas crear la BD manualmente:
```sql
CREATE DATABASE kiora_products;
```

### 4. Correr las migraciones

```bash
npm run migrate:up          # usa .env.local (BD local/expuesta)
npm run migrate:up:docker   # usa .env.docker (dentro del contenedor)
```

### 5. Arrancar el servidor

```bash
npm run dev   # Desarrollo (recarga automática)
npm start     # Producción
```

---

## Dominio y Base de Datos

El `products-service` es dueño absoluto de:
- Tabla `Categoria`
- Tabla `Producto`

Los demás servicios (ej. inventario, ventas) almacenan el ID del producto como un entero (`cod_prod`) sin realizar relaciones de clave foránea en la base de datos (Foreign Keys). La consistencia de los datos se mantiene en la capa de aplicación mediante llamadas a la API REST de este servicio.

## Scripts disponibles

```bash
npm run dev              # Servidor en modo desarrollo
npm start                # Servidor en producción
npm test                 # Tests (smoke HTTP con DB mockeada)
npm run test:migrations  # Integración: Postgres real; requiere RUN_MIGRATION_TESTS=true (usa dotenv .env.local)
npm run lint             # ESLint
npm run audit:ci         # CI: npm audit --audit-level=critical (Cloudinary v1 reporta high hasta upgrade mayor)
npm run migrate:up       # Aplicar migraciones (.env.local)
npm run migrate:down     # Revertir la última migración (.env.local)
```

Contratos con otros servicios: [../../docs/INTER_SERVICE_CONTRACTS.md](../../docs/INTER_SERVICE_CONTRACTS.md).
