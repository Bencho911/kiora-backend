-- Migration: 002_add_lock_policy
-- HU04: Política de bloqueo de cuenta
-- Agrega columnas de seguridad a la tabla Cliente

-- Up Migration
ALTER TABLE Cliente
    ADD COLUMN IF NOT EXISTS intentos_fallidos INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP NULL;

-- Down Migration
-- ALTER TABLE Cliente
--     DROP COLUMN IF EXISTS intentos_fallidos,
--     DROP COLUMN IF EXISTS bloqueado_hasta;
