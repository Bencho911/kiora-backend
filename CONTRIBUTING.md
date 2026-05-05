# Guía de contribución — Kiora Backend

Este documento recoge **gobernanza del repo** y el **plan de auditoría por fases**: cómo contribuir sin degradar calidad ni seguridad.

---

## Roadmap del plan de auditoría

| Fase | Alcance | Estado |
|------|---------|--------|
| **0 — Baseline y gobernanza** | Ramas protegidas (documentado aquí), DoD por servicio, inventario de secretos ([docs/SECRETS_INVENTORY.md](docs/SECRETS_INVENTORY.md)). | Hecho |
| **1 — CI homogéneo por microservicio** | Lint + tests + `audit:ci` en Actions para todos los servicios Node que exponen API (incluye **notifications-service**). | Hecho |
| **2 — Infra declarativa y cobertura reports** | Validación de `docker compose config` en CI; **reports-service** con ESLint, Jest (smoke) y audit nivel high. | Hecho |
| **3 — Deuda de dependencias focalizada** | **products-service:** SDK **Cloudinary ≥2.7** (corrección [GHSA-g4mf-96x5-5m2c](https://github.com/advisories/GHSA-g4mf-96x5-5m2c)), almacenamiento Multer con **`multer-storage-cloudinary-v2`**; `audit:ci` alineado a **high**. **reports-service:** *moderate* **exceljs→uuid** sigue documentado hasta upgrade upstream compatible con el stack CJS/Jest actual. | Hecho |

Las secciones siguientes detallan la Fase 0 operativa; las Fases 1–2 se reflejan en [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## 1. Lineamiento base del repositorio (Fase 0.1)

### Objetivo

- **`main` y `develop` estables**: solo código que pasa CI y revisión.
- **Tags de release** opcionales para marcar versiones desplegables (`v1.2.0`, etc.).

### Configuración en GitHub (mantenedores)

Configurar en **Settings → Branches → Branch protection rules** para `main` (y recomendado para `develop`):

| Regla | Motivo |
|--------|--------|
| Require a pull request before merging | Evitar pushes directos accidentales |
| Require status checks to pass | CI debe estar verde antes del merge |
| Require branches to be up to date before merging | Menos conflictos y builds reproducibles |
| (Opcional) Require approvals | Según tamaño del equipo |

#### Pasos prácticos (branch protection)

1. En el repositorio: **Settings** → **Branches** → **Add branch protection rule** (o editar la regla existente).
2. **Branch name pattern**: `main` (repetir el proceso para `develop` si el equipo lo usa como integración).
3. Activar **Require a pull request before merging** (recomendado).
4. Activar **Require status checks to pass before merging** y, debajo, **Require branches to be up to date before merging** (recomendado para que `main`/`develop` solo avancen sobre la última base verificada).
5. En el buscador de checks, añadir **todos** los jobs que quieras bloquear merge (la lista exacta está en la tabla siguiente). GitHub solo muestra checks que **ya hayan corrido al menos una vez** contra esa rama (suelen aparecer tras el primer PR/push que dispare el workflow).
6. Guardar la regla.

#### Lista explícita de status checks (referencia)

Los nombres deben coincidir **literalmente** con la propiedad `name:` de cada job en [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

| Check en GitHub (nombre del job) |
|----------------------------------|
| `Infra — docker compose (validación)` |
| `Tests — users-service` |
| `Migraciones — users-service (Postgres)` |
| `Tests — products-service` |
| `Migraciones — products-service (Postgres)` |
| `Tests — inventory-service` |
| `Tests — orders-service` |
| `Tests — notifications-service` |
| `Tests — reports-service` |
| `Tests — api-gateway` |

**Cuándo actualizar la regla:** si se añaden jobs nuevos al workflow (como en las Fases 1–2), hay que volver a **Branch protection rules**, editar la regla de `main`/`develop` y marcar los checks nuevos; hasta que no exista un run exitoso reciente, puede que no aparezcan en el buscador.

**Alternativa en equipos grandes:** algunos repos marcan solo un subconjunto de checks como obligatorios; aquí se recomienda **marcar todos los de la tabla** para que ningún PR degrade un servicio o la definición de Compose sin que CI lo demuestre.

### Convención de ramas

- `feat/descripcion-corta` — nueva funcionalidad  
- `fix/descripcion-corta` — corrección  
- `chore/descripcion-corta` — tareas de tooling/docs  

Los PR deben ser **pequeños** y con un objetivo claro (un microservicio o tema transversal acotado).

Si el cambio es **grande** (varios servicios, lockfiles extensos o riesgo de regresión), abrir una **rama dedicada** (`feat/…`, `fix/…`, `chore/…`) y un PR único y revisable, sin mezclar otros temas.

---

## 2. Definition of Done (DoD) por servicio (Fase 0.2)

Antes de pedir review o merge, el autor comprueba lo siguiente según **qué carpetas toca el PR**:

### Tabla mínima

| Área tocada | Obligatorio antes del merge |
|-------------|-----------------------------|
| **Cualquier `services/*`** | `npm ci` (o `npm install`) y **`npm run lint`** sin errores en ese servicio |
| **Servicio con tests Jest** | **`npm test`** en ese servicio |
| **Cambio en `src/db/migrations/*.sql`** | **`npm run migrate:up`** en entorno local contra BD de prueba **y** si existe job de migraciones en CI para ese servicio, que el PR mantenga ese job verde |
| **Cambio en contratos HTTP entre servicios** | Actualizar [docs/INTER_SERVICE_CONTRACTS.md](docs/INTER_SERVICE_CONTRACTS.md) |
| **Variables de entorno nuevas** | Actualizar `.env.example` del servicio **sin valores secretos reales** |
| **Raíz: `docker-compose.yml`, CI** | `docker compose config` válido; workflows coherentes con los servicios modificados |

### Por servicio (referencia rápida)

| Servicio | Lint | Tests | Migraciones (integración) | Audit CI |
|----------|------|-------|-----------------------------|----------|
| users-service | sí | sí | sí (`test:migrations`) | high |
| products-service | sí | sí (smoke) | sí (`test:migrations`) | high |
| inventory-service | sí | sí (smoke) | — | high |
| orders-service | sí | sí (smoke) | — | high |
| notifications-service | sí | sí (smoke) | — | high |
| reports-service | sí | sí (smoke) | — | high† |
| api-gateway | sí | sí (smoke) | — | high |
| Otros | según `package.json` del servicio | | | |

†`npm audit` puede seguir reportando vulnerabilidades **moderate** transitivas (cadena **exceljs** → **uuid**). Subir **uuid** a versiones parcheadas (≥14) rompe hoy la cadena **CommonJS + Jest** con **exceljs**; la política CI es `--audit-level=high`. Seguir releases de **exceljs** o valorar sustituto cuando el equipo priorice cerrar esos *moderate*.

### Checklist del autor (copiar en descripción del PR)

```markdown
## Checklist
- [ ] Lint del/los servicio(s) tocado(s)
- [ ] Tests del/los servicio(s) tocado(s)
- [ ] Migraciones aplicadas localmente si cambié SQL
- [ ] `.env.example` actualizado si hay nuevas variables
- [ ] Documentación de contratos actualizada si cambié llamadas entre servicios
```

---

## 3. Secretos e inventario (Fase 0.3)

- **Nunca** commitear `.env`, `.env.local`, `.env.docker` con valores reales (están en `.gitignore`; igualmente revisar antes de `git add`).
- Usar la plantilla **[docs/SECRETS_INVENTORY.md](docs/SECRETS_INVENTORY.md)** para llevar un inventario **fuera del repo** (gestor de equipo, vault).
- Si alguna credencial llegó a estar en historial git público: **rotar** en el proveedor (JWT, SMTP, DB, APIs) y valorar **limpieza de historial** con ayuda de GitHub/Git docs.

Detalle operativo: [docs/SECRETS_INVENTORY.md](docs/SECRETS_INVENTORY.md).

---

## 4. Commits y mensajes

- Mensajes en **español o inglés**, pero **consistentes** en el PR.
- Preferir commits atómicos; evitar un único commit gigante que mezcle refactors no relacionados.

---

## 5. Dudas

Abrir un issue con etiqueta `question` o consultar con el mantenedor del área que toques.
