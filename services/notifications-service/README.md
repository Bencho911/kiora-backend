# Kiora — Notifications Service

Microservicio dedicado exclusivamente al envío de notificaciones (emails, alertas, etc.) del ecosistema Kiora.
Es un servicio desprovisto de Base de Datos relacional propia. Consiste en un **Subscriber de Redis (Pub/Sub)** y un servidor HTTP para health-checks. Construido con **Node.js**, **Express** y **Nodemailer**.

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

## Arquitectura de Pub/Sub

El servicio escucha ininterrumpidamente un canal en Redis (configurado en la variable `REDIS_NOTIFICATIONS_CHANNEL`, por defecto `kiora:notifications`).

Para emitir un email desde cualquier otro microservicio, se debe inyectar el payload publicándolo explícitamente como string JSON a ese canal en Redis.

### Ejemplo de payload esperado:
```javascript
// Desde users-service, orders-service...
redisClient.publish('kiora:notifications', JSON.stringify({
    to: "usuario@kiora.com",
    subject: "Bienvenido a Kiora!",
    html: "<h1>Hola mundo</h1><p>Has sido registrado en el sistema.</p>",
    text: "Hola mundo. Has sido registrado en el sistema." // Opcional
}));
```

Si el servidor de correos (SMTP) falla, el error es capturado por Winston Logger y se deja registro para monitorización.
