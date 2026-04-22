-- Migration: 003_add_activo_to_cliente
-- HU44: Soft delete de usuarios — la columna activo permite "eliminar" sin perder datos históricos

-- Up Migration
ALTER TABLE Cliente
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Down Migration
-- ALTER TABLE Cliente DROP COLUMN IF EXISTS activo;
