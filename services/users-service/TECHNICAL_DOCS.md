# Documentación Técnica — Kiora Users Service

**Versión:** 1.0.0  
**Tecnología:** Node.js 20 + Express 5 + PostgreSQL 16  
**Última actualización:** Marzo 2026

---

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Arquitectura](#2-arquitectura)
3. [Estructura de Archivos](#3-estructura-de-archivos)
4. [Dependencias](#4-dependencias)
5. [Variables de Entorno](#5-variables-de-entorno)
6. [Base de Datos](#6-base-de-datos)
7. [Componentes Principales](#7-componentes-principales)
8. [Flujo de Ejecución](#8-flujo-de-ejecución)
9. [API Reference](#9-api-reference)
10. [Seguridad](#10-seguridad)
11. [Testing](#11-testing)
12. [DevOps](#12-devops)
13. [Consideraciones de Implementación](#13-consideraciones-de-implementación)

---

## 1. Descripción General

El **Users Service** es un microservicio REST del sistema Kiora responsable de:

- Autenticación de usuarios (login, logout, refresh de tokens)
- Gestión de usuarios (registro, consulta, actualización, eliminación, bloqueo/desbloqueo)
- Control de acceso por roles (`admin`, `cliente`)
- Política de seguridad de cuentas (bloqueo por intentos fallidos)
- Recuperación de contraseña por email (Resend)

El servicio opera de forma **independiente** y se comunica a través de HTTP. Está diseñado para servir tanto a clientes **web** (React) como **móviles** (React Native).

---

## 2. Arquitectura

### Patrón: Arquitectura en Capas (SOLID)

```
HTTP Request
     │
     ▼
┌─────────────┐
│   Routes    │  Declara rutas y middlewares. Sin lógica de negocio.
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Middleware  │  verifyToken, isAdmin, validate(Joi), loginLimiter
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Controller  │  Orquesta la lógica de negocio. Llama a Repository y Service.
└──────┬──────┘
       │
   ┌───┴───┐
   ▼       ▼
┌──────┐ ┌─────────┐
│ Repo │ │ Service │
└──┬───┘ └────┬────┘
   │           │
   ▼           ▼
┌──────┐   ┌───────┐
│  DB  │   │  JWT  │
└──────┘   └───────┘
```

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Routes | `routes/authRoutes.js` | Definir rutas y encadenar middlewares |
| Middleware | `middleware/` | Autenticación, validación, errores |
| Controller | `controllers/authController.js` | Lógica de negocio |
| Repository | `repositories/userRepository.js` | Acceso a base de datos |
| Service | `services/authService.js` | Generación y verificación de JWT |

### Principios SOLID aplicados

- **S** — Cada archivo tiene una única razón para cambiar
- **D** — El controller depende de abstracciones (repository, service), no de implementaciones directas

---

## 3. Estructura de Archivos

```
users-service/
├── src/
│   ├── app.js
│   ├── index.js
│   ├── config/
│   │   ├── blacklist.js          # Blacklist de tokens con Redis (ioredis)
│   │   ├── db.js                 # Pool de conexiones PostgreSQL
│   │   ├── emailService.js       # Envío de emails con Resend SDK
│   │   ├── env.js                # Validación de variables de entorno al inicio
│   │   ├── logger.js             # Logger Winston
│   │   └── swagger.js            # Configuración swagger-jsdoc
│   ├── middleware/
│   │   ├── authMiddleware.js     # verifyToken, isAdmin, blacklist de tokens
│   │   ├── errorHandler.js       # Middleware global de errores (Express)
│   │   └── validate.js           # Factory de validación Joi
│   ├── validators/
│   │   └── authValidators.js     # Schemas Joi: login, register, update, role, forgot, reset
│   ├── repositories/
│   │   └── userRepository.js     # Todas las queries SQL (Cliente + reset_tokens)
│   ├── services/
│   │   └── authService.js        # Generación/verificación de JWT y opciones de cookie
│   ├── controllers/
│   │   └── authController.js     # Funciones de negocio
│   ├── routes/
│   │   └── authRoutes.js         # Rutas con JSDoc Swagger
│   ├── db/
│   │   └── migrations/
│   │       ├── 001_schema_inicial.sql
│   │       ├── 002_add_lock_policy.sql
│   │       ├── 003_add_activo_to_cliente.sql
│   │       └── 004_add_reset_tokens.sql
│   └── __tests__/
│       └── authRoutes.test.js    # 48 tests de integración
├── .env
├── .env.example
├── .gitignore
├── Dockerfile
├── package.json
└── README.md
```

---

## 4. Dependencias

### Producción

| Paquete | Versión | Propósito |
|---|---|---|
| `express` | ^5 | Framework HTTP |
| `pg` | ^8 | Cliente PostgreSQL |
| `bcrypt` | ^6 | Hash de contraseñas |
| `jsonwebtoken` | ^9 | Generación y verificación de JWT |
| `cookie-parser` | ^1.4 | Parseo de cookies HTTP |
| `cors` | ^2.8 | Control de Cross-Origin Resource Sharing |
| `helmet` | ^8 | Cabeceras de seguridad HTTP |
| `express-rate-limit` | ^8 | Rate limiting por IP |
| `ioredis` | ^5 | Cliente Redis (blacklist de tokens) |
| `nodemailer` | ^8 | Envío de emails transaccionales vía SMTP |
| `joi` | ^17 | Validación de esquemas de datos |
| `winston` | ^3 | Logger con niveles y transports |
| `node-pg-migrate` | ^8 | Sistema de migraciones de base de datos |
| `dotenv` | ^17 | Carga de variables de entorno desde `.env` |
| `swagger-jsdoc` | ^6 | Generación de spec OpenAPI desde JSDoc |
| `swagger-ui-express` | ^5 | UI web de Swagger |

### Desarrollo

| Paquete | Propósito |
|---|---|
| `jest` | Framework de testing |
| `supertest` | Testing de endpoints HTTP |
| `nodemon` | Recarga automática en desarrollo |

---

## 5. Variables de Entorno

Todas son validadas en `src/config/env.js` al arrancar. Si falta alguna, el proceso termina con error.

| Variable | Requerida | Descripción | Ejemplo |
|---|---|---|---|
| `PORT` | No | Puerto del servidor | `3001` |
| `DB_USER` | ✅ | Usuario de PostgreSQL | `postgres` |
| `DB_PASSWORD` | ✅ | Contraseña de PostgreSQL | `rootpassword` |
| `DB_HOST` | ✅ | Host de la base de datos | `localhost` |
| `DB_PORT` | ✅ | Puerto de PostgreSQL | `5433` |
| `DB_NAME` | ✅ | Nombre de la base de datos | `kiora` |
| `JWT_SECRET` | ✅ | Clave para firmar Access Tokens | (string largo y aleatorio) |
| `JWT_REFRESH_SECRET` | ✅ | Clave para firmar Refresh Tokens | (string largo y aleatorio) |
| `REDIS_HOST` | No | Host de Redis | `localhost` |
| `REDIS_PORT` | No | Puerto de Redis | `6379` |
| `REDIS_PASSWORD` | No | Contraseña de Redis (si aplica) | — |
| `SMTP_HOST` | No* | Host SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | No* | Puerto SMTP | `587` |
| `SMTP_USER` | No* | Usuario SMTP | `tu_usuario` |
| `SMTP_PASS` | No* | Password SMTP | `tu_password` |
| `SMTP_SECURE` | No* | SSL en SMTP (true/false) | `false` |
| `FROM_EMAIL` | No* | Email remitente | `no-reply@kiora.com` |
| `APP_URL` | No* | URL base del frontend | `http://localhost:3000` |
| `CORS_ORIGIN` | No | Origen permitido para CORS | `http://localhost:3000` |
| `NODE_ENV` | No | Entorno de ejecución | `development` / `production` |

*Requeridas para activar el flujo de recuperación de contraseña (HU05).

---

## 6. Base de Datos

### Motor
**PostgreSQL 16** con pool de conexiones gestionado por `pg.Pool`.

### Tabla principal: `Cliente`

```sql
CREATE TABLE Cliente (
    id_usu            SERIAL PRIMARY KEY,
    nom_usu           VARCHAR(60),
    correo_usu        VARCHAR(100) UNIQUE,
    password_usu      VARCHAR(255),        -- bcrypt hash
    rol_usu           VARCHAR(30),         -- 'admin' | 'cliente'
    tel_usu           VARCHAR(20),
    intentos_fallidos INT DEFAULT 0,       -- HU04: política de bloqueo
    bloqueado_hasta   TIMESTAMP NULL,      -- NULL = no bloqueado
    activo            BOOLEAN DEFAULT true -- HU44: soft delete
);
```

### Tabla `reset_tokens` (HU05)

```sql
CREATE TABLE reset_tokens (
    id        SERIAL PRIMARY KEY,
    id_usu    INT NOT NULL REFERENCES Cliente(id_usu),
    token     VARCHAR(255) NOT NULL,
    expira_en TIMESTAMP NOT NULL,          -- 15 minutos desde creación
    usado     BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Sistema de Migraciones

```
src/db/migrations/
  001_schema_inicial.sql          ← Crea todas las tablas del sistema
  002_add_lock_policy.sql         ← Agrega intentos_fallidos y bloqueado_hasta
  003_add_activo_to_cliente.sql   ← Agrega columna activo (soft delete)
  004_add_reset_tokens.sql        ← Crea tabla para recuperación de contraseña
  005_add_unique_email_cliente.sql
  006_add_session_version_to_cliente.sql
  007_drop_unique_token_from_reset_tokens.sql ← Para OTP (códigos) ya no forzamos UNIQUE global
```

**Comandos:**
```bash
npm run migrate:up     # Aplica migraciones pendientes
npm run migrate:down   # Revierte la última migración
npm run migrate:create nombre  # Crea nueva migración vacía
```

El estado de las migraciones se guarda en la tabla `pgmigrations` de la propia DB.

---

## 7. Componentes Principales

### 7.1 `src/config/db.js` — Conexión a la Base de Datos

Crea y exporta un `Pool` de conexiones PostgreSQL. El pool gestiona automáticamente las conexiones concurrentes.

```js
const pool = new Pool({
    user, host, database, password, port  // desde process.env
});
```

### 7.2 `src/config/logger.js` — Logger Winston

Logger centralizado con los siguientes niveles (de mayor a menor severidad):
`error` > `warn` > `info` > `debug`

- **Desarrollo**: Salida a consola con colores y formato legible
- **Producción**: JSON a consola + archivos `logs/error.log` y `logs/combined.log`

### 7.3 `src/middleware/authMiddleware.js` — Autenticación

Exporta tres funciones:

#### `verifyToken(req, res, next)`
Verifica el Access Token desde dos fuentes (en orden):
1. Cookie `token` (clientes web)
2. Header `Authorization: Bearer <token>` (clientes móviles)

Si el token es válido, inyecta `req.usuario` y `req.token`. Rechaza tokens en la blacklist.

#### `isAdmin(req, res, next)`
Verifica que `req.usuario.rol_usu === 'admin'`. Se encadena después de `verifyToken`.

#### `addToBlacklist(token)`
Agrega un token al `Set` en memoria. Los tokens en esta lista son rechazados por `verifyToken`.

> **Limitación:** La blacklist es en memoria. Se pierde al reiniciar el servidor. En producción se recomienda Redis.

### 7.4 `src/middleware/validate.js` — Validación Joi

Factory que convierte un schema Joi en middleware Express:

```js
const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: messages });
    next();
};
```

### 7.5 `src/repositories/userRepository.js` — Acceso a Datos

Único punto de acceso a la tabla `Cliente`. Todas las queries usan **parámetros posicionales** (`$1`, `$2`) para prevenir inyección SQL.

| Función | SQL | Descripción |
|---|---|---|
| `findByEmail(email)` | `SELECT * FROM Cliente WHERE correo_usu = $1 AND activo = true` | Búsqueda para login |
| `findById(id)` | `SELECT ... WHERE id_usu = $1 AND activo = true` | Búsqueda para refresh |
| `findProfile(id)` | `SELECT ... WHERE id_usu = $1 AND activo = true` | Datos públicos del perfil |
| `findAll(limit, offset)` | `SELECT ... WHERE activo = true LIMIT $1 OFFSET $2` | Lista paginada |
| `countAll()` | `SELECT COUNT(*) FROM Cliente WHERE activo = true` | Total para paginación |
| `create(...)` | `INSERT INTO Cliente ... RETURNING id_usu` | Registro de usuario |
| `update(id, fields)` | `UPDATE Cliente SET <campos> WHERE id_usu = $n AND activo = true` | Actualización parcial dinámica |
| `softDelete(id)` | `UPDATE Cliente SET activo = false WHERE id_usu = $1` | Soft delete |
| `updateRole(id, rol)` | `UPDATE Cliente SET rol_usu = $1 WHERE id_usu = $2` | Cambio de rol |
| `incrementLoginAttempts(id, n)` | `UPDATE ... SET intentos_fallidos = $1` | Incrementa contador |
| `blockUser(id, n)` | `UPDATE ... SET bloqueado_hasta = '9999-...'` | Bloqueo indefinido |
| `resetLoginAttempts(id)` | `UPDATE ... SET intentos_fallidos = 0` | Reset tras login ok |
| `unlock(id)` | `UPDATE ... SET intentos_fallidos = 0, bloqueado_hasta = NULL` | Desbloqueo por admin |
| `createResetToken(id, token, exp)` | `INSERT INTO reset_tokens ...` | Guarda token de recuperación |
| `findResetToken(token)` | `SELECT ... WHERE token = $1 AND usado = false AND expira_en > NOW()` | Valida token |
| `markTokenAsUsed(token)` | `UPDATE reset_tokens SET usado = true` | Invalida token usado |
| `updatePassword(id, hash)` | `UPDATE Cliente SET password_usu = $1` | Actualiza contraseña |

### 7.6 `src/services/authService.js` — Lógica JWT

Centraliza toda la lógica de tokens. Ningún otro archivo genera JWTs directamente.

| Función | Descripción |
|---|---|
| `generateAccessToken(usuario)` | JWT firmado con `JWT_SECRET`, expira en **10 minutos** |
| `generateRefreshToken(usuario)` | JWT firmado con `JWT_REFRESH_SECRET`, expira en **7 días** |
| `verifyRefreshToken(token)` | Verifica y decodifica un Refresh Token |
| `cookieOptions(maxAgeMs)` | Genera opciones de cookie: `httpOnly: true`, `secure` en producción |

**Payload del token:**
```json
{
  "id_usu": 1,
  "correo_usu": "user@kiora.com",
  "rol_usu": "cliente",
  "iat": 1234567890,
  "exp": 1234568490
}
```

### 7.7 `src/controllers/authController.js` — Lógica de Negocio

Orquesta el flujo de cada endpoint. Delega queries al repository y tokens al service.

| Función | Endpoint | Descripción |
|---|---|---|
| `login` | `POST /login` | Valida credenciales, aplica política de bloqueo, emite tokens |
| `register` | `POST /register` | Verifica email único, hashea password, crea usuario |
| `refresh` | `POST /refresh` | Rota el refresh token, emite nuevos tokens |
| `logout` | `POST /logout` | Agrega token a blacklist Redis, limpia cookies |
| `getUsers` | `GET /users` | Lista paginada de usuarios activos (solo admin) |
| `getMe` | `GET /me` | Perfil del usuario autenticado |
| `unlockUser` | `PATCH /users/:id/unlock` | Resetea bloqueo de cuenta (solo admin) |
| `updateUser` | `PATCH /users/:id` | Actualiza nombre, correo o teléfono (solo admin) |
| `deleteUser` | `DELETE /users/:id` | Soft delete — no puede eliminarse a sí mismo |
| `updateRole` | `PATCH /users/:id/role` | Cambia rol — no puede cambiar el propio |
| `forgotPassword` | `POST /forgot-password` | Genera token y envía email via Resend. Siempre 200 |
| `resetPassword` | `POST /reset-password` | Valida token, actualiza contraseña, invalida token |

---

## 8. Flujo de Ejecución

### Arranque del Servidor

```
node src/index.js
       │
       ├── require('./config/env')     ← Valida variables de entorno
       │       └── Si falta alguna → process.exit(1)
       │
       ├── require('./app')             ← Configura Express
       │       ├── helmet()             ← Cabeceras de seguridad
       │       ├── cors()               ← CORS con origen permitido
       │       ├── cookieParser()       ← Parsea cookies
       │       ├── express.json()       ← Parsea body JSON
       │       ├── GET /api/docs        ← Swagger UI
       │       ├── /api/auth → authRoutes
       │       └── errorHandler         ← Siempre al final
       │
       └── app.listen(PORT)             ← Servidor escuchando
```

### Flujo de Login (caso exitoso)

```
POST /api/auth/login
       │
       ├── loginLimiter        ← Máximo 10 req/15min por IP
       ├── validate(loginSchema) ← Joi: correo e-mail válido, password required
       └── login()             ← Controller
               │
               ├── userRepository.findByEmail()
               ├── Verificar bloqueado_hasta
               ├── bcrypt.compare(password, hash)
               ├── userRepository.resetLoginAttempts()
               ├── authService.generateAccessToken()
               ├── authService.generateRefreshToken()
               ├── res.cookie('kiora_refresh_token', ...)
               │
               ├── Si x-client-type: web
               │       └── res.cookie('token', ...) + res.json({ usuario })
               └── Si cliente móvil
                       └── res.json({ token, usuario })
```

### Flujo de Refresh Token

```
POST /api/auth/refresh
       │
       └── refresh()           ← Controller
               │
               ├── Leer cookie 'kiora_refresh_token'
               ├── authService.verifyRefreshToken()
               ├── userRepository.findById()
               ├── Verificar no bloqueado
               ├── addToBlacklist(oldRefreshToken)  ← Rotación
               ├── authService.generateAccessToken()
               ├── authService.generateRefreshToken()
               ├── res.cookie('kiora_refresh_token', newToken)
               └── res.json({ token: newAccessToken })
```

### Flujo de Error

```
Cualquier controller con error inesperado
       │
       └── next(error)
               │
               └── errorHandler (middleware global)
                       ├── logger.error(...)
                       └── res.status(500).json({ error: mensaje })
```

---

## 9. API Reference

Base URL: `http://localhost:3001`  
Documentación interactiva: `GET /api/docs`

### Autenticación

Los endpoints protegidos requieren el token en una de estas formas:

- **Web:** Cookie `token` (HttpOnly, enviada automáticamente)
- **Móvil:** Header `Authorization: Bearer <access_token>`

### Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/login` | No | Iniciar sesión |
| `POST` | `/api/auth/register` | Admin | Registrar usuario |
| `POST` | `/api/auth/refresh` | Cookie | Renovar tokens |
| `POST` | `/api/auth/logout` | Sí | Cerrar sesión |
| `GET` | `/api/auth/me` | Sí | Perfil propio |
| `GET` | `/api/auth/users?page=1&limit=20` | Admin | Lista paginada |
| `PATCH` | `/api/auth/users/:id` | Admin | Actualizar nombre/correo/teléfono |
| `DELETE` | `/api/auth/users/:id` | Admin | Eliminar usuario (soft delete) |
| `PATCH` | `/api/auth/users/:id/unlock` | Admin | Desbloquear cuenta |
| `PATCH` | `/api/auth/users/:id/role` | Admin | Asignar rol |
| `POST` | `/api/auth/forgot-password` | No | Solicitar recuperación de contraseña |
| `POST` | `/api/auth/reset-password` | No | Restablecer contraseña con token |

### Respuesta de `GET /api/auth/users` (paginada)

```json
{
  "data": [
    {
      "id_usu": 1,
      "nom_usu": "Ruben",
      "correo_usu": "ruben@kiora.com",
      "rol_usu": "admin",
      "intentos_fallidos": 0,
      "bloqueado_hasta": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Códigos de respuesta

| Código | Significado |
|---|---|
| `200` | OK |
| `201` | Creado |
| `400` | Datos inválidos (Joi) |
| `401` | No autenticado / credenciales incorrectas |
| `403` | Sin permisos (no admin) |
| `404` | Recurso no encontrado |
| `409` | Conflicto (correo ya registrado) |
| `423` | Cuenta bloqueada |
| `500` | Error interno del servidor |

---

## 10. Seguridad

### Contraseñas
- Almacenadas con **bcrypt** (salt rounds: 10)
- Nunca se devuelven en ninguna respuesta

### Tokens JWT
- **Access Token:** Expira en 10 minutos, firmado con `JWT_SECRET`
- **Refresh Token:** Expira en 7 días, firmado con `JWT_REFRESH_SECRET`
- **Rotación:** Al hacer refresh, el token anterior se invalida en la blacklist
- **Blacklist:** Redis con TTL automático via `ioredis`. En tests usa stub en memoria.

### Soft Delete (HU44)
- Los usuarios eliminados no se borran de la BD (`activo = false`)
- Preserva integridad referencial con `Factura` y `Ventas`
- Todos los `findAll` y `findById` filtran `WHERE activo = true`
- Un admin no puede eliminarse a sí mismo

### Recuperación de Contraseña (HU05)
- Token seguro generado con `crypto.randomUUID()`
- Expira en **15 minutos**, almacenado en tabla `reset_tokens`
- Enviado por email via **Resend SDK**
- Siempre responde 200 para evitar **user enumeration attacks**
- El token se marca como `usado = true` tras utilizarse (no reutilizable)

### Política de Bloqueo de Cuentas (HU04)
- Máximo **5 intentos fallidos** consecutivos
- Al alcanzar el límite: `bloqueado_hasta = '9999-12-31'` (bloqueo indefinido)
- Solo un administrador puede desbloquear vía `PATCH /users/:id/unlock`

### Cabeceras HTTP (Helmet)
Helmet agrega automáticamente:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (en producción)
- `Content-Security-Policy`
- y otras ~10 cabeceras de seguridad

### Rate Limiting
- Login: máximo **10 requests por IP** cada 15 minutos

### CORS
- Origen restringido a `CORS_ORIGIN` del `.env`
- Solo métodos `GET, POST, PUT, PATCH, DELETE`
- Credenciales permitidas para cookies

---

## 11. Testing

### Tecnología
- **Jest** como framework de testing
- **Supertest** para simular requests HTTP sin levantar el servidor

### Cobertura (48 tests)

| Suite | Tests |
|---|---|
| `POST /api/auth/login` | 7 casos |
| `POST /api/auth/register` | 4 casos |
| `POST /api/auth/logout` | 2 casos |
| `GET /api/auth/users` | 3 casos |
| `POST /api/auth/refresh` | 5 casos |
| `GET /api/auth/me` | 4 casos |
| `PATCH /api/auth/users/:id` | 5 casos (HU43) |
| `DELETE /api/auth/users/:id` | 5 casos (HU44) |
| `PATCH /api/auth/users/:id/role` | 6 casos (HU45) |
| `POST /api/auth/forgot-password` | 3 casos (HU05) |
| `POST /api/auth/reset-password` | 4 casos (HU05) |

### Estrategia de Mock

Dos mocks configurados al inicio del archivo:
- `jest.mock('../config/db')` — Evita conexión real a PostgreSQL
- `jest.mock('../config/emailService')` — Evita llamadas reales a Resend

```bash
npm test          # Corre todos los tests
npm run test:watch  # Modo watch durante desarrollo
```

---

## 12. DevOps

### Docker

**`Dockerfile`** — Imagen multi-etapa:
1. **Etapa `base`**: Instala dependencias de producción con `npm ci`
2. **Etapa final**: Copia el código, crea usuario sin privilegios (`appuser`), expone puerto 3001

### `docker-compose.yml`

Levanta 4 servicios:
- **`kiora-db`**: PostgreSQL 16 con healthcheck
- **`kiora-redis`**: Redis 7 con healthcheck y volumen persistente
- **`kiora-pgadmin`**: interfaz web en `http://localhost:5050`
- **`users-service`**: espera que DB y Redis estén healthy

```bash
# Desde kiora-backend/
docker compose up           # Levanta todo
docker compose up -d        # En background
docker compose down         # Detiene y elimina contenedores
docker compose down -v      # Detiene y elimina incluyendo volúmenes
```

### GitHub Actions CI/CD

Archivo: `.github/workflows/ci.yml`

**Disparadores:**
- Push a `main` o `develop`
- Pull Request a `main` o `develop`

**Pasos del pipeline:**
1. `actions/checkout@v4` — Descarga el código
2. `actions/setup-node@v4` — Instala Node.js 20 con caché de npm
3. `npm ci` — Instala dependencias de forma determinista
4. `npm test -- --forceExit` — Corre los 48 tests (sin BD real, todo mockeado)

---

## 13. Consideraciones de Implementación

### ¿Por qué bcrypt con 10 salt rounds?
10 rounds es el balance estándar entre seguridad y rendimiento (hashear tarda ~100ms). En hardware más potente se puede subir a 12.

### ¿Por qué dos tokens (Access + Refresh)?
- **Access Token corto (10 min):** Minimiza el daño si es robado
- **Refresh Token largo (7 días):** UX sin login frecuente, rotado en cada uso

### ¿Por qué `IF NOT EXISTS` en las migraciones?
Permite que las migraciones sean **idempotentes**: si se corren dos veces, no fallan. Seguro para CI/CD.

### Limitaciones conocidas

| Limitación | Impacto | Solución futura |
|---|---|---|
| Sin 2FA | Seguridad de login básica | TOTP con `speakeasy` |
| Blacklist en Redis (single node) | Si Redis cae, tokens revocados se aceptan temporalmente (fail-open) | Redis Sentinel o Cluster |

### Escalabilidad
El servicio es **stateless** en cuanto a la lógica de negocio. La blacklist de tokens usa Redis, lo que permite escalar horizontalmente sin perder estado entre instancias.
