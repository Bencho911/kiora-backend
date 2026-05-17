-- =============================================================================
-- kiora_schema.sql — Referencia global del esquema de base de datos
-- =============================================================================
-- Este archivo es SOLO DOCUMENTACIÓN. Cada servicio crea sus propias tablas
-- a través de sus migraciones internas en src/db/migrations/.
--
-- Dueño de cada tabla:
--   👤 users-service        → kiora_users      (puerto 5433)
--   📦 products-service     → kiora_products   (puerto 5434)
--   🏭 inventory-service    → kiora_inventory  (puerto 5435)
--   📋 orders-service       → kiora_orders     (puerto 5436)
--   🔔 notifications-service→ kiora_notifications (puerto 5437)
--
-- Las referencias entre dominios son simples columnas INT (sin FK de BD).
-- La consistencia se mantiene a nivel de aplicación mediante llamadas HTTP.
--
-- Generado a partir del conjunto completo de migraciones de cada servicio.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- DOMINIO: users-service (kiora_users)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE Cliente (
    id_usu            SERIAL PRIMARY KEY,
    nom_usu           VARCHAR(60),
    correo_usu        VARCHAR(100),
    password_usu      VARCHAR(255),        -- bcrypt hash
    rol_usu           VARCHAR(30),         -- 'admin' | 'cliente'
    tel_usu           VARCHAR(20),
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta   TIMESTAMP NULL,
    activo            BOOLEAN NOT NULL DEFAULT true,
    session_version   INTEGER NOT NULL DEFAULT 0
);

-- Índice único: solo un usuario activo por email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_correo_activo
    ON Cliente (lower(trim(correo_usu)))
    WHERE activo = true;

CREATE TABLE reset_tokens (
    id        SERIAL PRIMARY KEY,
    id_usu    INT NOT NULL REFERENCES Cliente(id_usu),
    token     VARCHAR(255) NOT NULL,
    expira_en TIMESTAMP NOT NULL,
    usado     BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_reset_tokens_id_usu_usado_expira
    ON reset_tokens (id_usu, usado, expira_en);

CREATE TABLE ReporteFallo (
    id_rep                SERIAL PRIMARY KEY,
    descripcion           TEXT NOT NULL,
    prioridad             VARCHAR(20) DEFAULT 'media',
    estado                VARCHAR(20) DEFAULT 'pendiente',
    fk_id_usu             INTEGER NOT NULL REFERENCES Cliente(id_usu) ON DELETE CASCADE,
    cod_prod              INTEGER NULL,
    fecha_rep             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones_tecnicas TEXT NULL,
    titulo                TEXT NULL
);


-- ─────────────────────────────────────────────────────────────────────────────
-- DOMINIO: products-service (kiora_products)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE Categoria (
    cod_cat     SERIAL PRIMARY KEY,
    nom_cat     VARCHAR(40) NOT NULL,
    descrip_cat TEXT,
    activo      BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE Producto (
    cod_prod        SERIAL PRIMARY KEY,
    nom_prod        VARCHAR(100)   NOT NULL,
    descrip_prod    TEXT,
    precio_unitario DECIMAL(10, 2) NOT NULL CHECK (precio_unitario >= 0),
    fechaven_prod   DATE,
    -- Array de categorías (un producto puede estar en varias)
    fk_cod_cats     INTEGER[] DEFAULT '{}',
    stock_actual    INTEGER NOT NULL DEFAULT 0,
    stock_minimo    INTEGER NOT NULL DEFAULT 0,
    url_imagen      VARCHAR(500),
    activo          BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT chk_stock_actual_no_negativo CHECK (stock_actual >= 0)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- DOMINIO: inventory-service (kiora_inventory)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE Proveedor (
    cod_prov    SERIAL PRIMARY KEY,
    id_prov     VARCHAR(50),
    nom_prov    VARCHAR(100) NOT NULL,
    tel_prov    VARCHAR(20) NOT NULL,
    tipoid_prov VARCHAR(20),
    correo_prov VARCHAR(100) NOT NULL,
    dir_prov    VARCHAR(200)
);

CREATE TABLE Inventario (
    id_mov           SERIAL PRIMARY KEY,
    tipo_mov         VARCHAR(50) NOT NULL,        -- 'entrada' | 'salida' | 'ajuste'
    fecha_mov        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cantidad         INT NOT NULL CHECK (cantidad > 0),
    cod_prod         INT NOT NULL,                -- → products-service.Producto (sin FK)
    fk_cod_prov      INT REFERENCES Proveedor(cod_prov) ON DELETE SET NULL,
    fk_id_vent       INT,                         -- → orders-service.Ventas (idempotencia)
    desc_mov         VARCHAR(255),
    fecha_vencimiento DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_venta_producto_tipo
    ON Inventario (fk_id_vent, cod_prod, tipo_mov)
    WHERE fk_id_vent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventario_cod_prod ON Inventario(cod_prod);
CREATE INDEX IF NOT EXISTS idx_inventario_fk_id_vent ON Inventario(fk_id_vent);

CREATE TABLE Suministra (
    id                SERIAL PRIMARY KEY,
    fk_cod_prov       INT NOT NULL REFERENCES Proveedor(cod_prov) ON DELETE CASCADE,
    cod_prod          INT NOT NULL,              -- → products-service.Producto (sin FK)
    stock             INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_minimo      INT NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    fecha_vencimiento DATE,
    UNIQUE (fk_cod_prov, cod_prod)
);

CREATE INDEX IF NOT EXISTS idx_suministra_cod_prod ON Suministra(cod_prod);


-- ─────────────────────────────────────────────────────────────────────────────
-- DOMINIO: orders-service (kiora_orders)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE Ventas (
    id_vent           SERIAL PRIMARY KEY,
    fecha_vent        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    precio_prod_final DECIMAL(10, 2) NOT NULL CHECK (precio_prod_final >= 0),
    montofinal_vent   DECIMAL(10, 2) NOT NULL CHECK (montofinal_vent >= 0),
    metodopago_usu    VARCHAR(50),
    estado            VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    stripe_payment_id VARCHAR(100)              -- ID de pago Stripe para reembolsos
    -- 'pendiente' | 'pagado' | 'completada' | 'cancelada' | 'reembolsada'
);

CREATE TABLE Producto_Venta (
    id          SERIAL PRIMARY KEY,
    fk_id_vent  INT NOT NULL REFERENCES Ventas(id_vent) ON DELETE CASCADE,
    cod_prod    INT NOT NULL,                   -- → products-service.Producto (sin FK)
    cantidad    INT NOT NULL CHECK (cantidad > 0),
    precio_unit DECIMAL(10, 2) NOT NULL CHECK (precio_unit >= 0),
    nom_prod    VARCHAR(255)                    -- Desnormalizado para historial
);

CREATE INDEX IF NOT EXISTS idx_producto_venta_fk_id_vent ON Producto_Venta(fk_id_vent);

CREATE TABLE Factura (
    id              SERIAL PRIMARY KEY,
    fk_id_vent      INT NOT NULL REFERENCES Ventas(id_vent) ON DELETE CASCADE,
    id_usu          INT NOT NULL,               -- → users-service.Cliente (sin FK)
    cantidad_vent   INT NOT NULL CHECK (cantidad_vent > 0),
    precio_prod     DECIMAL(10, 2) NOT NULL CHECK (precio_prod >= 0),
    montototal_vent DECIMAL(10, 2) NOT NULL CHECK (montototal_vent >= 0),
    emitida_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_factura_fk_id_vent ON Factura(fk_id_vent);
CREATE INDEX IF NOT EXISTS idx_factura_id_usu ON Factura(id_usu);

-- Tabla de eventos Outbox para consistencia distribuida
CREATE TABLE IF NOT EXISTS outbox_events (
    id            SERIAL PRIMARY KEY,
    event_type    VARCHAR(50) NOT NULL,
    payload       JSONB NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count   INT NOT NULL DEFAULT 0,
    max_retries   INT NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox_events(next_retry_at)
    WHERE status = 'pending';


-- ─────────────────────────────────────────────────────────────────────────────
-- DOMINIO: notifications-service (kiora_notifications)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alertas (
    id         SERIAL PRIMARY KEY,
    tipo       VARCHAR(20) NOT NULL DEFAULT 'general',   -- 'stock_bajo' | 'vencimiento' | 'general'
    mensaje    TEXT NOT NULL,
    metadata   JSONB,
    leida      BOOLEAN NOT NULL DEFAULT false,
    creada_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
