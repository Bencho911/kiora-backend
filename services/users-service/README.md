# Kiora — Users Service

Servicio de autenticación y gestión de usuarios del sistema Kiora. Construido con **Node.js**, **Express**, **PostgreSQL** y **Redis**.

---

## Requisitos previos

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (recomendado)

---

## Opción A: Levantar con Docker (recomendado)

```bash
# Desde la raíz del backend (kiora-backend/)
docker compose up
```

Levanta automáticamente:
- PostgreSQL en el puerto `5433`
- Redis en el puerto `6379`
- pgAdmin en `http://localhost:5050`
- Users Service en `http://localhost:3001`

**Salud del servicio**
- Liveness: `GET /api/users/health` (solo indica que el proceso responde).
- Readiness: `GET /api/users/ready` (comprueba PostgreSQL y Redis; usar en balanceadores/orquestadores).

En **producción** conviene `BLACKLIST_FAIL_OPEN=false` para no aceptar tráfico autenticado si Redis no permite verificar la blacklist (respuesta `503`).

---

## Opción B: Levantar manualmente

### 1. Instalar dependencias

```bash
cd kiora-backend/services/users-service
npm install
```

### 2. Configurar variables de entorno

Usa **dos archivos** para no mezclar `localhost` con nombres de servicio Docker (`users-db`, `kiora-redis`):

```bash
cp .env.example .env.local
cp .env.example .env.docker
```

- **`.env.local`**: `npm run dev`, `npm start`, `npm run migrate:up` desde tu máquina.  
  `DATABASE_URL` / `DB_HOST` apuntan a `localhost` (puerto `5433` si solo levantas Postgres con Compose).
- **`.env.docker`**: lo usa `docker compose` para el contenedor `users-service`.  
  Ahí van `users-db`, `kiora-redis` y `DATABASE_URL` con host `users-db`.

**Orden de carga** (ver `src/config/env.js`): variable `ENV_FILE` → si existe `.env.local` → si no, `.env`.

**Si tenías un `.env` antiguo:** copia su contenido a `.env.local` (ajusta `DATABASE_URL` a `localhost`) y a `.env.docker` (host `users-db`), luego **elimina `.env`** para no confundirte con valores contradictorios.

**Seguridad de secretos**
- Nunca subas `.env.local` ni `.env.docker` al repositorio (están ignorados por `.gitignore`).
- Si alguna credencial se expuso por error (SMTP/JWT/DB), rótala inmediatamente.
- En producción usa un gestor de secretos o variables del runtime (no archivos versionados).

### 3. Crear la base de datos

```sql
CREATE DATABASE kiora_users;
```

### 4. Correr las migraciones

```bash
npm run migrate:up          # usa .env.local
npm run migrate:up:docker   # usa .env.docker
```

### 4b. Tests de migraciones (integración)

Requieren **PostgreSQL accesible** con la misma configuración que `.env.local` (el script carga `dotenv` desde ahí). Ejecutan `node-pg-migrate up` y comprueban tablas, columnas e índices (001–008).

```bash
# Con la BD levantada (Docker o local)
npm run test:migrations
```

En **GitHub Actions** hay un job `migrations-users-service` con Postgres 16 que corre esta suite en cada push/PR.

### 5. (Opcional) Crear usuarios de prueba

```bash
node src/scripts/seed.js
# Requiere variables:
#   SEED_ADMIN_PASSWORD=... SEED_SUPPORT_PASSWORD=...
# Opcionales:
#   SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, SEED_ADMIN_PHONE
#   SEED_SUPPORT_EMAIL, SEED_SUPPORT_NAME, SEED_SUPPORT_PHONE
```

### 6. Arrancar el servidor

```bash
npm run dev   # Desarrollo (recarga automática)
npm start     # Producción
```

---

## Endpoints disponibles

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `POST` | `/api/auth/login` | Iniciar sesión | No |
| `POST` | `/api/auth/register` | Registrar usuario | Admin |
| `POST` | `/api/auth/logout` | Cerrar sesión | Sí |
| `POST` | `/api/auth/refresh` | Renovar token | Cookie |
| `GET` | `/api/auth/me` | Perfil propio | Sí |
| `PATCH` | `/api/auth/me/password` | Cambiar contraseña propia | Sí |
| `GET` | `/api/auth/users` | Lista de usuarios paginada | Admin |
| `PATCH` | `/api/auth/users/:id` | Actualizar usuario | Admin |
| `DELETE` | `/api/auth/users/:id` | Eliminar usuario (soft delete) | Admin |
| `PATCH` | `/api/auth/users/:id/unlock` | Desbloquear cuenta | Admin |
| `PATCH` | `/api/auth/users/:id/role` | Asignar rol | Admin |
| `POST` | `/api/auth/forgot-password` | Solicitar recuperación de contraseña | No |
| `POST` | `/api/auth/reset-password` | Restablecer contraseña con código OTP | No |
| `POST` | `/api/auth/verify-reset-code` | Verificar código OTP de recuperación | No |

Los endpoints OTP (`forgot-password`, `verify-reset-code`, `reset-password`) tienen rate limiting y pueden responder `429` cuando se excede el límite temporal.

### Documentación interactiva (Swagger)

```
http://localhost:3001/api/docs
```

---

## Scripts disponibles

```bash
npm run dev              # Servidor en modo desarrollo
npm start                # Servidor en producción
npm test                 # Correr todos los tests
npm run lint             # ESLint (src, sin warnings)
npm run lint:fix         # ESLint con --fix
npm run audit:ci         # npm audit --audit-level=high (uso en CI)
npm run test:migrations  # Postgres real: aplica migraciones y valida esquema (usa .env.local)
npm run migrate:up       # Aplicar migraciones pendientes (.env.local)
npm run migrate:down     # Revertir la última migración (.env.local)
npm run migrate:up:docker     # Aplicar migraciones usando .env.docker
npm run migrate:down:docker   # Revertir migración usando .env.docker
npm run migrate:create   # Crear nueva migración
```

---

## Arquitectura del proyecto

```
src/
├── app.js
├── index.js
├── config/
│   ├── blacklist.js        # Blacklist de tokens con Redis (ioredis)
│   ├── db.js               # Conexión a PostgreSQL
│   ├── emailService.js     # Envío de emails con Nodemailer (SMTP)
│   ├── env.js              # Validación de variables de entorno
│   ├── logger.js           # Logger Winston
│   └── swagger.js          # Configuración Swagger
├── middleware/
│   ├── authMiddleware.js   # verifyToken, isAdmin
│   ├── errorHandler.js     # Manejo centralizado de errores
│   └── validate.js         # Factory de validación Joi
├── validators/
│   └── authValidators.js   # Schemas Joi
├── repositories/
│   └── userRepository.js   # Único punto de acceso a la DB
├── services/
│   └── authService.js      # Lógica JWT
├── controllers/
│   └── authController.js   # Lógica de negocio
├── routes/
│   └── authRoutes.js       # Rutas + Swagger JSDoc
├── db/
│   └── migrations/
│       ├── 001_schema_inicial.sql
│       ├── 002_add_lock_policy.sql
│       ├── 003_add_activo_to_cliente.sql
│       ├── 004_add_reset_tokens.sql
│       ├── 005_add_unique_email_cliente.sql
│       └── 006_add_session_version_to_cliente.sql
└── __tests__/
    └── authRoutes.test.js  # tests HTTP (Jest + Supertest)
```

---

## Autenticación

El servicio soporta **dos tipos de clientes**:

**Web (React, etc.):**
- Access Token en cookie `HttpOnly` (más seguro)
- Header `x-client-type: web` en el login

**Móvil (React Native, etc.):**
- Access Token en el body JSON
- `Authorization: Bearer <token>` en cada request

El **Refresh Token** siempre va en cookie `HttpOnly`.

Los JWT incluyen el claim **`sv` (session_version)** alineado con la columna `Cliente.session_version`. Al **restablecer** o **cambiar** contraseña se incrementa esa versión, invalidando **todos** los access y refresh tokens anteriores del usuario (además de blacklist en logout/rotación).

---

## CI/CD

**GitHub Actions** (push/PR a `main` y `develop`), ver `.github/workflows/ci.yml`:

- **test-users-service**: ESLint, `npm audit`, tests HTTP (Jest + mocks).
- **migrations-users-service**: Postgres 16 en servicio, `npm run test:migrations` (aplica SQL y valida esquema).
