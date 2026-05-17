-- Schema export for products-service

-- Migration: 001_schema_inicial
-- Dominio: products-service
-- Tablas del catálogo de productos: categorías y productos.
--
-- NOTA: Las FK cruzadas con otros dominios (inventario, órdenes)
-- no existen aquí — la consistencia se mantiene a nivel de aplicación.

-- Up Migration
CREATE TABLE IF NOT EXISTS Categoria (
    cod_cat     SERIAL PRIMARY KEY,
    nom_cat     VARCHAR(40)  NOT NULL,
    descrip_cat TEXT
);

CREATE TABLE IF NOT EXISTS Producto (
    cod_prod        SERIAL PRIMARY KEY,
    nom_prod        VARCHAR(100)   NOT NULL,
    descrip_prod    TEXT,
    precio_unitario DECIMAL(10, 2) NOT NULL CHECK (precio_unitario >= 0),
    fechaven_prod   DATE,
    -- FK local: categoría está en este mismo servicio
    fk_cod_cat      INT REFERENCES Categoria(cod_cat) ON DELETE SET NULL
);

-- Down Migration
-- DROP TABLE IF EXISTS Producto;
-- DROP TABLE IF EXISTS Categoria;


-- Migration: 002_add_stock_columns
-- Dominio: products-service
-- Añade columnas de stock centralizado a la tabla Producto.
-- stock_actual: existencias reales del producto.
-- stock_minimo: umbral para alertas de stock crítico.

-- Up Migration
ALTER TABLE Producto
    ADD COLUMN IF NOT EXISTS stock_actual INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stock_minimo INTEGER NOT NULL DEFAULT 0;

-- Down Migration
-- ALTER TABLE Producto DROP COLUMN IF EXISTS stock_actual;
-- ALTER TABLE Producto DROP COLUMN IF EXISTS stock_minimo;


-- Migration: 003_add_stock_check_constraint
-- Dominio: products-service
-- Añade CHECK constraint para prevenir que stock_actual sea negativo.

-- Up Migration
ALTER TABLE Producto
    ADD CONSTRAINT chk_stock_actual_no_negativo CHECK (stock_actual >= 0);

-- Down Migration
-- ALTER TABLE Producto DROP CONSTRAINT IF EXISTS chk_stock_actual_no_negativo;


-- Migración 004: Añadir campo de imagen a productos
ALTER TABLE Producto ADD COLUMN url_imagen VARCHAR(500);


-- Migration: 005_add_activo_to_producto
-- Dominio: products-service
-- Soft delete: agregar campo activo a la tabla Producto.
-- Los registros existentes se marcan como activo = true por defecto.

-- Up Migration
ALTER TABLE Producto ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Down Migration
-- ALTER TABLE Producto DROP COLUMN IF EXISTS activo;


-- Migration: 006_add_activo_to_categoria
-- Dominio: products-service
-- Soft delete: agregar campo activo a la tabla Categoria.
-- Los registros existentes se marcan como activo = true por defecto.

-- Up Migration
ALTER TABLE Categoria ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Down Migration
-- ALTER TABLE Categoria DROP COLUMN IF EXISTS activo;


-- Migration: 007_rename_fk_cod_cat_to_fk_cod_cats
-- Dominio: products-service
-- Cambia la columna fk_cod_cat (FK individual) a fk_cod_cats (array de categorías).
-- Permite que un producto pertenezca a múltiples categorías.

-- Up Migration

-- 1. Eliminar la FK constraint existente
ALTER TABLE Producto DROP CONSTRAINT IF EXISTS producto_fk_cod_cat_fkey;

-- 2. Renombrar la columna
ALTER TABLE Producto RENAME COLUMN fk_cod_cat TO fk_cod_cats_old;

-- 3. Agregar nueva columna tipo array
ALTER TABLE Producto ADD COLUMN IF NOT EXISTS fk_cod_cats INTEGER[] DEFAULT '{}';

-- 4. Migrar datos existentes: convertir el valor individual a array
UPDATE Producto
SET fk_cod_cats = ARRAY[fk_cod_cats_old]
WHERE fk_cod_cats_old IS NOT NULL;

-- 5. Eliminar la columna vieja
ALTER TABLE Producto DROP COLUMN IF EXISTS fk_cod_cats_old;

-- Down Migration
-- ALTER TABLE Producto ADD COLUMN fk_cod_cat INT;
-- UPDATE Producto SET fk_cod_cat = fk_cod_cats[1] WHERE array_length(fk_cod_cats, 1) > 0;
-- ALTER TABLE Producto DROP COLUMN fk_cod_cats;
-- ALTER TABLE Producto ADD CONSTRAINT producto_fk_cod_cat_fkey FOREIGN KEY (fk_cod_cat) REFERENCES Categoria(cod_cat) ON DELETE SET NULL;


