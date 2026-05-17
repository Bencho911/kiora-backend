-- Schema export for inventory-service

-- Migration: 001_schema_inicial
-- Dominio: inventory-service
-- Tablas de inventario: proveedores, movimientos de stock y suministros.
--
-- NOTAS sobre FK cruzadas eliminadas:
--   · Inventario.fk_cod_prod apuntaba a Producto (products-service).
--     Ahora es un INT plano; la validación ocurre vía HTTP al registrar
--     un movimiento.
--   · Suministra.fk_cod_prod2 ídem.

-- Up Migration
CREATE TABLE IF NOT EXISTS Proveedor (
    cod_prov    SERIAL PRIMARY KEY,
    id_prov     VARCHAR(50),
    nom_prov    VARCHAR(100) NOT NULL,
    tel_prov    VARCHAR(20),
    tipoid_prov VARCHAR(20)
);

-- Movimientos de stock (entradas / salidas)
CREATE TABLE IF NOT EXISTS Inventario (
    id_mov    SERIAL PRIMARY KEY,
    tipo_mov  VARCHAR(50) NOT NULL, -- 'entrada' | 'salida' | 'ajuste'
    fecha_mov DATE        NOT NULL DEFAULT CURRENT_DATE,
    cantidad  INT         NOT NULL CHECK (cantidad > 0),
    -- referencia al producto en products-service (sin FK de BD)
    cod_prod  INT         NOT NULL
);

-- Relación proveedor → producto con stock actual disponible
CREATE TABLE IF NOT EXISTS Suministra (
    id         SERIAL PRIMARY KEY,
    fk_cod_prov INT NOT NULL REFERENCES Proveedor(cod_prov) ON DELETE CASCADE,
    -- referencia al producto en products-service (sin FK de BD)
    cod_prod   INT NOT NULL,
    stock      INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    UNIQUE (fk_cod_prov, cod_prod)
);

-- Down Migration
-- DROP TABLE IF EXISTS Suministra;
-- DROP TABLE IF EXISTS Inventario;
-- DROP TABLE IF EXISTS Proveedor;


-- Migration: 002_add_stock_minimo
-- Dominio: inventory-service
-- Agrega columna stock_minimo a la tabla Suministra.
-- HU14 — Configurar stock mínimo por relación proveedor-producto.

-- Up Migration
ALTER TABLE Suministra
    ADD COLUMN IF NOT EXISTS stock_minimo INT NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0);

-- Down Migration
-- ALTER TABLE Suministra DROP COLUMN IF EXISTS stock_minimo;


-- Migration: 003_add_fk_cod_prov_inventario
-- Dominio: inventory-service
-- Añade columna fk_cod_prov a la tabla Inventario para trazabilidad
-- de entradas de mercancía por proveedor.

-- Up Migration
ALTER TABLE Inventario
    ADD COLUMN IF NOT EXISTS fk_cod_prov INTEGER REFERENCES Proveedor(cod_prov) ON DELETE SET NULL;

-- Down Migration
-- ALTER TABLE Inventario DROP COLUMN IF EXISTS fk_cod_prov;


-- Migration: 004_add_fk_id_vent_inventario
-- Dominio: inventory-service
-- Añade columna fk_id_vent a la tabla Inventario para idempotencia.
-- Permite rastrear qué venta originó un movimiento de salida automático
-- y evitar duplicados cuando una orden se completa más de una vez.

-- Up Migration
ALTER TABLE Inventario
    ADD COLUMN IF NOT EXISTS fk_id_vent INTEGER;

-- Índice único parcial: solo una salida automática por venta+producto
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_venta_producto
    ON Inventario (fk_id_vent, cod_prod)
    WHERE fk_id_vent IS NOT NULL;

-- Down Migration
-- DROP INDEX IF EXISTS uq_inventario_venta_producto;
-- ALTER TABLE Inventario DROP COLUMN IF EXISTS fk_id_vent;


-- Migration: 005_add_indexes
-- Dominio: inventory-service
-- Agregar índices en columnas de FK y filtro frecuente
-- para mejorar rendimiento de queries.

-- Up Migration
CREATE INDEX IF NOT EXISTS idx_inventario_cod_prod ON Inventario(cod_prod);
CREATE INDEX IF NOT EXISTS idx_inventario_fk_id_vent ON Inventario(fk_id_vent);
CREATE INDEX IF NOT EXISTS idx_suministra_cod_prod ON Suministra(cod_prod);

-- Down Migration
-- DROP INDEX IF EXISTS idx_inventario_cod_prod;
-- DROP INDEX IF EXISTS idx_inventario_fk_id_vent;
-- DROP INDEX IF EXISTS idx_suministra_cod_prod;


-- Migration: 006_add_supplier_fields
-- Dominio: inventory-service
-- Agrega columnas correo_prov y dir_prov a la tabla Proveedor.

-- Up Migration
ALTER TABLE Proveedor 
    ADD COLUMN IF NOT EXISTS correo_prov VARCHAR(100),
    ADD COLUMN IF NOT EXISTS dir_prov    VARCHAR(200);

-- Down Migration
-- ALTER TABLE Proveedor DROP COLUMN IF EXISTS correo_prov;
-- ALTER TABLE Proveedor DROP COLUMN IF EXISTS dir_prov;


-- Migration: 007_add_desc_mov_to_inventario
-- Dominio: inventory-service
-- Agrega columna desc_mov a la tabla Inventario para guardar justificaciones de movimientos.

-- Up Migration
ALTER TABLE Inventario 
    ADD COLUMN IF NOT EXISTS desc_mov VARCHAR(255);

-- Down Migration
-- ALTER TABLE Inventario DROP COLUMN IF EXISTS desc_mov;


-- Migration: 008_fix_inventario_precision_and_refunds
-- Dominio: inventory-service

-- 1. Mejorar precisión de fecha (incluir hora/minuto/segundo)
ALTER TABLE Inventario 
    ALTER COLUMN fecha_mov TYPE TIMESTAMP 
    USING fecha_mov::timestamp;

ALTER TABLE Inventario 
    ALTER COLUMN fecha_mov SET DEFAULT CURRENT_TIMESTAMP;

-- 2. Corregir índice de idempotencia para permitir reembolsos
-- El índice anterior prohibía más de un movimiento por (venta, producto).
-- El nuevo permite uno por cada TIPO (uno de salida y uno de entrada).

DROP INDEX IF EXISTS uq_inventario_venta_producto;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_venta_producto_tipo
    ON Inventario (fk_id_vent, cod_prod, tipo_mov)
    WHERE fk_id_vent IS NOT NULL;


-- Migration: 007_require_supplier_fields
-- Dominio: inventory-service
-- Hace obligatorios los campos de teléfono y correo para Proveedores.

-- Up Migration
UPDATE Proveedor SET tel_prov = '0000000000' WHERE tel_prov IS NULL OR tel_prov = '';
UPDATE Proveedor SET correo_prov = 'sin_correo@proveedor.com' WHERE correo_prov IS NULL OR correo_prov = '';

ALTER TABLE Proveedor ALTER COLUMN tel_prov SET NOT NULL;
ALTER TABLE Proveedor ALTER COLUMN correo_prov SET NOT NULL;

-- Down Migration
ALTER TABLE Proveedor ALTER COLUMN tel_prov DROP NOT NULL;
ALTER TABLE Proveedor ALTER COLUMN correo_prov DROP NOT NULL;


