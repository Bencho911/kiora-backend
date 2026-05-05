-- Migration: 006_add_session_version_to_cliente
-- Permite invalidar todos los JWT (access + refresh) al cambiar/restablecer contraseña.

ALTER TABLE Cliente
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
