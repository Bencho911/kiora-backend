-- Migration: 008_fix_inventario_precision_and_refunds
-- Dominio: inventory-service

-- 1. Mejorar precisión de fecha (incluir hora/minuto/segundo)
ALTER TABLE Inventario 
    ALTER COLUMN fecha_mov TYPE TIMESTAMP 
    USING fecha_mov::timestamp;

ALTER TABLE Inventario 
    ALTER COLUMN fecha_mov SET DEFAULT CURRENT_TIMESTAMP;

-- 2. Corregir índice de idempotencia para permitir reembolsos
-- El índice anterior prohibía más de un movimiento por (venta, producto).
-- El nuevo permite uno por cada TIPO (uno de salida y uno de entrada).

DROP INDEX IF EXISTS uq_inventario_venta_producto;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventario_venta_producto_tipo
    ON Inventario (fk_id_vent, cod_prod, tipo_mov)
    WHERE fk_id_vent IS NOT NULL;
