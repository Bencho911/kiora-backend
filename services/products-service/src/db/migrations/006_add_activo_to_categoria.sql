-- Migration: 006_add_activo_to_categoria
-- Dominio: products-service
-- Soft delete: agregar campo activo a la tabla Categoria.
-- Los registros existentes se marcan como activo = true por defecto.

-- Up Migration
ALTER TABLE Categoria ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Down Migration
-- ALTER TABLE Categoria DROP COLUMN IF EXISTS activo;
