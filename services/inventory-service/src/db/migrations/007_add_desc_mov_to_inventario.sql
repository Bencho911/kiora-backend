-- Migration: 007_add_desc_mov_to_inventario
-- Dominio: inventory-service
-- Agrega columna desc_mov a la tabla Inventario para guardar justificaciones de movimientos.

-- Up Migration
ALTER TABLE Inventario 
    ADD COLUMN IF NOT EXISTS desc_mov VARCHAR(255);

-- Down Migration
-- ALTER TABLE Inventario DROP COLUMN IF EXISTS desc_mov;
