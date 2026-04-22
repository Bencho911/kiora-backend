-- =============================================================================
-- kiora_schema.sql — Referencia global del esquema de base de datos
-- =============================================================================
-- Este archivo es SOLO DOCUMENTACIÓN. Cada servicio crea sus propias tablas
-- a través de sus migraciones internas en src/db/migrations/.
--
-- Dueño de cada tabla:
--   📦 products-service  → kiora_products  (puerto 5434)
--   🏭 inventory-service → kiora_inventory (puerto 5435)
--   📋 orders-service    → kiora_orders    (puerto 5436)
--   👤 users-service     → kiora_users     (puerto 5433)
--
-- Las referencias entre dominios son simples columnas INT (sin FK de BD).
-- La consistencia se mantiene a nivel de aplicación mediante llamadas HTTP.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- DOMINIO: users-service (kiora_users)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE Cliente (
    id_usu            SERIAL PRIMARY KEY,
    nom_usu           VARCHAR(60),
    correo_usu        VARCHAR(100) UNIQUE,
    password_usu      VARCHAR(255),        -- bcrypt hash
    rol_usu           VARCHAR(30),         -- 'admin' | 'cliente'
    tel_usu           VARCHAR(20),
    intentos_fallidos INT DEFAULT 0,
    bloqueado_hasta   TIMESTAMP NULL,
    activo            BOOLEAN DEFAULT true,
    session_version   INT DEFAULT 0
);

CREATE TABLE reset_tokens (
    id        SERIAL PRIMARY KEY,
    id_usu    INT NOT NULL REFERENCES Cliente(id_usu),
    token     VARCHAR(255) NOT NULL,
    expira_en TIMESTAMP NOT NULL,
    usado     BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ─────────────────────────────────────────────────────────────────────────────
-- DOMINIO: products-service (kiora_products)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE Categoria (
    cod_cat     SERIAL PRIMARY KEY,
    nom_cat     VARCHAR(40) NOT NULL,
    descrip_cat TEXT
);

CREATE TABLE Producto (
    cod_prod        SERIAL PRIMARY KEY,
    nom_prod        VARCHAR(100)   NOT NULL,
    descrip_prod    TEXT,
    precio_unitario DECIMAL(10, 2) NOT NULL CHECK (precio_unitario >= 0),
    fechaven_prod   DATE,
    fk_cod_cat      INT REFERENCES Categoria(cod_cat) ON DELETE SET NULL,
    stock_actual    INT NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo    INT NOT NULL DEFAULT 0
);


-- ─────────────────────────────────────────────────────────────────────────────
-- DOMINIO: inventory-service (kiora_inventory)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE Proveedor (
    cod_prov    SERIAL PRIMARY KEY,
    id_prov     VARCHAR(50),
    nom_prov    VARCHAR(100) NOT NULL,
    tel_prov    VARCHAR(20),
    tipoid_prov VARCHAR(20)
);

CREATE TABLE Inventario (
    id_mov    SERIAL PRIMARY KEY,
    tipo_mov  VARCHAR(50) NOT NULL,        -- 'entrada' | 'salida' | 'ajuste'
    fecha_mov DATE NOT NULL DEFAULT CURRENT_DATE,
    cantidad  INT NOT NULL CHECK (cantidad > 0),
    cod_prod  INT NOT NULL,                -- → products-service.Producto (sin FK)
    fk_cod_prov INT REFERENCES Proveedor(cod_prov) ON DELETE SET NULL,
    fk_id_vent  INT                        -- → orders-service.Ventas (idempotencia)
);

CREATE TABLE Suministra (
    id          SERIAL PRIMARY KEY,
    fk_cod_prov INT NOT NULL REFERENCES Proveedor(cod_prov) ON DELETE CASCADE,
    cod_prod    INT NOT NULL,              -- → products-service.Producto (sin FK)
    stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    UNIQUE (fk_cod_prov, cod_prod)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- DOMINIO: orders-service (kiora_orders)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE Ventas (
    id_vent           SERIAL PRIMARY KEY,
    fecha_vent        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    precio_prod_final DECIMAL(10, 2) NOT NULL CHECK (precio_prod_final >= 0),
    montofinal_vent   DECIMAL(10, 2) NOT NULL CHECK (montofinal_vent >= 0),
    metodopago_usu    VARCHAR(50),
    estado            VARCHAR(30) NOT NULL DEFAULT 'pendiente'
    -- 'pendiente' | 'completada' | 'cancelada'
);

CREATE TABLE Producto_Venta (
    id          SERIAL PRIMARY KEY,
    fk_id_vent  INT NOT NULL REFERENCES Ventas(id_vent) ON DELETE CASCADE,
    cod_prod    INT NOT NULL,              -- → products-service.Producto (sin FK)
    cantidad    INT NOT NULL CHECK (cantidad > 0),
    precio_unit DECIMAL(10, 2) NOT NULL CHECK (precio_unit >= 0)
);

CREATE TABLE Factura (
    id              SERIAL PRIMARY KEY,
    fk_id_vent      INT NOT NULL REFERENCES Ventas(id_vent) ON DELETE CASCADE,
    id_usu          INT NOT NULL,          -- → users-service.Cliente (sin FK)
    cantidad_vent   INT NOT NULL CHECK (cantidad_vent > 0),
    precio_prod     DECIMAL(10, 2) NOT NULL CHECK (precio_prod >= 0),
    montototal_vent DECIMAL(10, 2) NOT NULL CHECK (montototal_vent >= 0),
    emitida_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);