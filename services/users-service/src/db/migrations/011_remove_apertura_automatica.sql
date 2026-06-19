-- Migration: 011_remove_apertura_automatica
-- Dominio: users-service (settings)
-- Elimina la columna abrir_siguiente_automatico para forzar apertura manual y garantizar trazabilidad.

-- Up Migration
ALTER TABLE ajustes_sistema DROP COLUMN IF EXISTS abrir_siguiente_automatico;

-- Down Migration
ALTER TABLE ajustes_sistema ADD COLUMN abrir_siguiente_automatico BOOLEAN NOT NULL DEFAULT false;
