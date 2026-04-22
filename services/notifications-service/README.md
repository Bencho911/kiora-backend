# Kiora — Notifications Service

Microservicio dedicado exclusivamente al envío de notificaciones proactivas (emails, alertas automáticas, etc.) del ecosistema Kiora.
Es un servicio desprovisto de Base de Datos relacional propia. Consiste en un **Consumer Group de Redis Streams** y un servidor HTTP para health-checks. Construido con **Node.js**, **Express** y **Nodemailer**.

---

## Requisitos previos

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (recomendado)
- Servidor [Redis](https://redis.io/)

---

## Levantar con Docker (recomendado)

```bash
# Desde la raíz del backend (kiora-backend/)
docker compose up -d
```

Levanta automáticamente:
- Redis en el puerto local `6379`
- Notifications Service HTTP en `http://localhost:3005`

---

## Levantar manualmente

### 1. Instalar dependencias

```bash
cd kiora-backend/services/notifications-service
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
cp .env.example .env.docker
```

Además de configurar Redis (`REDIS_HOST`, `REDIS_PORT`), este servicio requiere configuración SMTP estricta para poder encenderse (usa credenciales dummy si todavía no las tienes, de lo contrario el proceso abortará). 

Variables obligatorias:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=tu_app_password
FROM_EMAIL=no-reply@kiora.com
```

### 3. Arrancar el servicio

*(No hay scripts de base de datos ni `node-pg-migrate` requeridos)*

```bash
npm run dev   # Desarrollo (recarga automática)
npm start     # Producción
```

---

## Arquitectura de Redis Streams

El servicio escucha ininterrumpidamente un **Stream** en Redis (`REDIS_NOTIFICATIONS_STREAM`, por defecto `notifications_stream`) utilizando *Consumer Groups* (`XREADGROUP`). Esto garantiza que los correos se envíen una sola vez y que ningún mensaje se pierda si el servicio cae (persistencia de pending entries sin ACK).

Para emitir un email desde cualquier otro microservicio (ej. `inventory-service` alertando por bajo stock, o `products-service` por caducidad), se debe inyectar el payload añadiéndolo al stream a través de `XADD`.

### Ejemplo de payload esperado:
```javascript
// Desde users-service, orders-service...
await redisClient.xadd(
    'notifications_stream', '*',
    'payload', JSON.stringify({
        to: "usuario@kiora.com",
        subject: "Alerta de Stock en Kiora!",
        html: "<h1>Bajo Stock Registrado</h1><p>Reabastecer a la brevedad.</p>"
    })
);
```

Si el servidor de correos (SMTP) falla, el error es capturado por Winston Logger y el mensaje no recibe el `ACK` en Redis, lo que permite reintentar el envío cuando el servicio se reconecte.
