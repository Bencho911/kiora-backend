-- Migration: 007_require_supplier_fields
-- Dominio: inventory-service
-- Hace obligatorios los campos de teléfono y correo para Proveedores.

-- Up Migration
UPDATE Proveedor SET tel_prov = '0000000000' WHERE tel_prov IS NULL OR tel_prov = '';
UPDATE Proveedor SET correo_prov = 'sin_correo@proveedor.com' WHERE correo_prov IS NULL OR correo_prov = '';

ALTER TABLE Proveedor ALTER COLUMN tel_prov SET NOT NULL;
ALTER TABLE Proveedor ALTER COLUMN correo_prov SET NOT NULL;

-- Down Migration
ALTER TABLE Proveedor ALTER COLUMN tel_prov DROP NOT NULL;
ALTER TABLE Proveedor ALTER COLUMN correo_prov DROP NOT NULL;
