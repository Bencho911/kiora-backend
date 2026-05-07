-- Migration: 009_add_vencimiento_to_lotes
-- Dominio: inventory-service

-- Añadir fecha de vencimiento al historial de movimientos
ALTER TABLE Inventario ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- Añadir fecha de vencimiento a la tabla de stock por proveedor
ALTER TABLE Suministra ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
