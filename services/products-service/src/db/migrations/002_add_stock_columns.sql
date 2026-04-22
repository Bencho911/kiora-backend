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
