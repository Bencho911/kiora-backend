-- Migration: 005_add_activo_to_producto
-- Dominio: products-service
-- Soft delete: agregar campo activo a la tabla Producto.
-- Los registros existentes se marcan como activo = true por defecto.

-- Up Migration
ALTER TABLE Producto ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Down Migration
-- ALTER TABLE Producto DROP COLUMN IF EXISTS activo;
