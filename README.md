---
title: "Kiora Backend Root"
tags: [root, kiora, backend]
---

# Kiora Backend 🚀

> 🌌 **Obsidian Vault:** Este repositorio está configurado como una Bóveda de Obsidian. Comienza la navegación por la documentación en [[Home]].

Sistema de **microservicios** para el kiosco inteligente Kiora.

**Contribuir:** [CONTRIBUTING.md](CONTRIBUTING.md) — Definition of Done, PRs y gobernanza de secretos ([docs/SECRETS_INVENTORY.md](docs/SECRETS_INVENTORY.md)).

---

## Arquitectura

El ecosistema de backend se compone actualmente de **10 servicios** independientes:

```
kiora-backend/
├── services/
│   ├── api-gateway/            # Punto de entrada único — proxy + Swagger agregado (puerto 3000)
│   ├── users-service/          # Autenticación y gestión de usuarios (puerto 3001)
│   ├── products-service/       # Catálogo de productos y categorías (puerto 3002)
│   ├── inventory-service/      # Stock, movimientos e inventario de proveedores (puerto 3003)
│   ├── orders-service/         # Ventas y facturación (puerto 3004)
│   ├── notifications-service/  # Emails vía Redis Streams / Consumer Groups (puerto 3005)
│   ├── reports-service/        # Emisión asíncrona de reportes y facturas en PDF (puerto 3006)
│   ├── activity-service/       # Registro de auditoría y logs de actividades del kiosco (puerto 3007)
│   ├── telegram-bot/           # Interfaz de mensajería y alertas a administradores (puerto 3008)
│   └── ai-service/             # Módulo de Inteligencia Artificial en Python (puerto 8000)
├── database/
│   └── kiora_schema.sql        # Referencia global del esquema (documentación)
├── docs/
│   └── INTER_SERVICE_CONTRACTS.md  # URLs, trazabilidad y dueño del stock entre servicios
└── docker-compose.yml          # Infraestructura local completa
```

Cada servicio es **autónomo**: tiene su propia base de datos (PostgreSQL), migraciones, Dockerfile y configuración de entorno. Las referencias cruzadas entre dominios se manejan mediante **llamadas HTTP** internas o mensajería asíncrona (ej. Outbox pattern o Redis Streams).

### API Gateway (puerto 3000)

Entrada recomendada para los clientes frontales: proxifica rutas como `/api/auth`, `/api/users`, `/api/inventory` hacia cada microservicio respectivo. Expone `GET /health/all` y Swagger unificado en `/api/docs`. 
Genera y reenvía el header **`x-correlation-id`** a los servicios detrás del proxy para mantener trazabilidad en los logs.

### 📚 Documentación de Arquitectura y Resiliencia

El backend está diseñado para soportar fallos parciales sin interrumpir el negocio:

- 📄 **[Contratos e Integración](docs/INTER_SERVICE_CONTRACTS.md)**: Comunicación HTTP/Outbox entre servicios.
- 🛡️ **[Matriz de Degradación](docs/DEGRADATION_MATRIX.md)**: Sagas/compensaciones ante caídas de red.
- 🚀 **[Estado de Producción](docs/PRODUCTION_READINESS.md)**: Madurez técnica (Beta, Prod-Ready).
- 🔑 **[Inventario de Secretos](docs/SECRETS_INVENTORY.md)**: Gobernanza de credenciales.

---

## Levantar el entorno local

Sigue estos pasos para configurar y ejecutar el proyecto:

1. **Configuración inicial**: Genera los archivos de entorno básicos.
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```
   *Nota: Las variables vitales (como `DATABASE_URL`) se inyectan a través de `docker-compose.yml`, asegurando que las migraciones funcionen sin configuraciones manuales extra en local.*

2. **Iniciar infraestructura**:
   ```bash
   docker-compose up -d
   ```

| Servicio               | URL / Puerto        | Base de datos / Dependencia |
|------------------------|---------------------|-----------------------------|
| api-gateway            | `localhost:3000`    | —                           |
| users-service          | `localhost:3001`    | `kiora_users` @ 5433        |
| products-service       | `localhost:3002`    | `kiora_products` @ 5434     |
| inventory-service      | `localhost:3003`    | `kiora_inventory` @ 5435    |
| orders-service         | `localhost:3004`    | `kiora_orders` @ 5436       |
| notifications-service  | `localhost:3005`    | Redis + SMTP                |
| reports-service        | `localhost:3006`    | PDFKit Stream               |
| activity-service       | `localhost:3007`    | `kiora_activity`            |
| telegram-bot           | `localhost:3008`    | Bot API                     |
| ai-service             | `localhost:8000`    | Python (FastAPI/Flask)      |
| Redis                  | `localhost:6379`    | —                           |
| pgAdmin                | `localhost:5050`    | —                           |

---

## Servicios Principales

### 🔐 users-service
Gestión de usuarios, autenticación JWT y perfiles. Swagger en `/api/docs`.

### 📦 products-service
Catálogo de productos y categorías.

### 🏭 inventory-service
Control de stock: movimientos de entrada/salida y proveedores. 

### 📋 orders-service
Ventas y facturación. Consulta a `users-service` e `inventory-service` via HTTP, usando patrón Outbox para consistencia eventual.

### 🤖 ai-service & telegram-bot
El ecosistema integra un servicio en Python para lógica IA generativa y un bot de Telegram integrado al sistema para reportar incidencias e insights al instante.

### 📊 activity-service
Responsable de llevar la traza inmutable (audit log) de eventos críticos operacionales en la plataforma.

---

## Migraciones

Cada servicio maneja sus propias migraciones (principalmente con `node-pg-migrate`):

```bash
# Desde el directorio del servicio (ej. users-service)
npm run migrate:up        # Aplica migraciones pendientes (local)
npm run migrate:up:docker # Aplica migraciones en contenedor Docker
```

> **Consideración Técnica:** El servicio `inventory-service` actualmente puede contener secuencias de migración colisionadas (ej. múltiples prefijos `009_`). Si la base de datos se levanta en limpio, valídalos cuidadosamente.

---

## CI/CD y Calidad de Código

**GitHub Actions** en cada push/PR a `main` o `develop`: validación de dependencias y pruebas automáticas.
- Herramientas: `eslint`, `npm audit`, `jest`. 
- Nota sobre `reports-service`: El audit arroja vulnerabilidades moderate sobre dependencias de PDF/Excel generadores que se solucionarán en un parche de librería base.

---

## 🛠️ Notas de Operación y Deuda Técnica

Para equipos de DevOps e infraestructura que llevan este sistema a producción, se recomienda revisar rigurosamente:

1. **Exposición de Puertos:** El archivo `docker-compose.yml` expone todos los puertos locales (`300X`, `543X`, `6379`). En **producción**, es vital usar un `docker-compose.prod.yml` que limite la exposición **únicamente** al puerto `3000` del `api-gateway`.
2. **CORS y Autorización Interna:** Las APIs asumen entorno confiable detrás del gateway. Asegurar que nadie excepto el gateway puede alcanzar directamente a los microservicios, para evitar un bypass de autenticación JWT.
3. **Rotación de Llaves:** Validar que ninguna llave de kiosko (`KIORA_API_KEY`) ni credenciales de Telegram existan de forma *hardcodeada* dentro de fallbacks en los servicios JS o Python.
