# Kiora — Inventory Service

Servicio responsable de la gestión de stock, entradas/salidas de inventario y el registro de proveedores del sistema Kiora. Construido con **Node.js**, **Express** y **PostgreSQL**.

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
- PostgreSQL (`kiora_inventory`) en el puerto local `5435`
- Inventory Service en `http://localhost:3003`

---

## Levantar manualmente

### 1. Instalar dependencias

```bash
cd kiora-backend/services/inventory-service
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
cp .env.example .env.docker
```

- **`.env.local`**: Desarrollo local. Usa `DB_HOST=localhost` y `DB_PORT=5435`.
- **`.env.docker`**: Dentro de los contenedores Docker. Usa `DB_HOST=inventory-db` y `DB_PORT=5432`.

Asegúrate de configurar `PRODUCTS_SERVICE_URL` correctamente para que este microservicio pueda comunicarse con el servicio de productos y validar la existencia de los mismos antes de realizar movimientos de stock.

Detalle de llamadas HTTP y trazabilidad: [../../docs/INTER_SERVICE_CONTRACTS.md](../../docs/INTER_SERVICE_CONTRACTS.md).

### 3. Crear la base de datos

Si usas una BD Postgres local en lugar de la que levanta Docker Compose:
```sql
CREATE DATABASE kiora_inventory;
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

El `inventory-service` es dueño absoluto de:
- Tabla `Proveedor`
- Tabla `Inventario` (movimientos de stock)
- Tabla `Suministra` (relación stock disponible por proveedor/producto)

**Nota arquitectónica:** Los campos `cod_prod` de este servicio son enteros (INT) y **no** son Foreign Keys (FK) hacia la base de datos de productos. La consistencia referencial se confía a nivel de aplicación consultando `products-service`.
