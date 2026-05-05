# Kiora — Orders Service

Servicio encargado de registrar las ventas, productos asociados a la venta y emisión de facturas o comprobantes en el sistema Kiora. Construido con **Node.js**, **Express** y **PostgreSQL**.

---

## Requisitos previos

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (recomendado)

---

## Levantar con Docker (recomendado)

```bash
# Desde la raíz del backend (kiora-backend/)
docker comSMTP para enviar códigos OTP (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ruben.camilo321@gmail.com
SMTP_PASS=toorvstcpiozvege
SMTP_SECURE=falsepose up -d
```

Levanta automáticamente:
- PostgreSQL (`kiora_orders`) en el puerto local `5436`
- Orders Service en `http://localhost:3004`

---

## Levantar manualmente

### 1. Instalar dependencias

```bash
cd kiora-backend/services/orders-service
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
cp .env.example .env.docker
```

- **`.env.local`**: Desarrollo local. Usa `DB_HOST=localhost` y `DB_PORT=5436`.
- **`.env.docker`**: Dentro de Docker. Usa `DB_HOST=orders-db` y `DB_PORT=5432`.

Este microservicio se comunica con:
- `users-service` (URL en variable `USERS_SERVICE_URL`) para obtener datos del cliente.
- `inventory-service` (URL en variable `INVENTORY_SERVICE_URL`) para descontar stock al consolidar una venta.

Contratos y comportamiento ante fallos: [../../docs/INTER_SERVICE_CONTRACTS.md](../../docs/INTER_SERVICE_CONTRACTS.md).

### 3. Correr las migraciones

Asegúrate de tener la BD creada (`CREATE DATABASE kiora_orders;` si no usas Docker Compose).

```bash
npm run migrate:up          # usa .env.local
npm run migrate:up:docker   # usa .env.docker
```

### 4. Arrancar el servidor

```bash
npm run dev   # Desarrollo (recarga automática)
npm start     # Producción
```

---

## Dominio y Base de Datos

El `orders-service` es dueño absoluto de:
- Tabla `Ventas`
- Tabla `Producto_Venta`
- Tabla `Factura`

**Nota arquitectónica:** Los campos `cod_prod` (producto) y `id_usu` (cliente) de estas tablas son enteros (INT) planos. No existen validaciones de Foreign Key estrictas en la base de datos hacia las bases de retención originarias. Las compras de productos que no existan no deben ocurrir gracias a validaciones HTTP previas.
