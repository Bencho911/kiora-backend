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
