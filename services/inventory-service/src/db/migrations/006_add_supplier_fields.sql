-- Migration: 006_add_supplier_fields
-- Dominio: inventory-service
-- Agrega columnas correo_prov y dir_prov a la tabla Proveedor.

-- Up Migration
ALTER TABLE Proveedor 
    ADD COLUMN IF NOT EXISTS correo_prov VARCHAR(100),
    ADD COLUMN IF NOT EXISTS dir_prov    VARCHAR(200);

-- Down Migration
-- ALTER TABLE Proveedor DROP COLUMN IF EXISTS correo_prov;
-- ALTER TABLE Proveedor DROP COLUMN IF EXISTS dir_prov;
