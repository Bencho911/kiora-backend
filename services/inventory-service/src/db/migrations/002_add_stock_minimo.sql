-- Migration: 002_add_stock_minimo
-- Dominio: inventory-service
-- Agrega columna stock_minimo a la tabla Suministra.
-- HU14 — Configurar stock mínimo por relación proveedor-producto.

-- Up Migration
ALTER TABLE Suministra
    ADD COLUMN IF NOT EXISTS stock_minimo INT NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0);

-- Down Migration
-- ALTER TABLE Suministra DROP COLUMN IF EXISTS stock_minimo;
