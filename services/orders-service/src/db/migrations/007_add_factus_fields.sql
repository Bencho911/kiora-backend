-- Migration: 007_add_factus_fields
-- Dominio: orders-service
-- Añade campos para almacenar los datos de facturación electrónica (Factus/DIAN)
-- en la tabla Factura, y el estatus fiscal de cada ítem en Producto_Venta.

-- Up Migration

-- Campos de facturación electrónica en Factura
ALTER TABLE Factura ADD COLUMN IF NOT EXISTS factus_cufe VARCHAR(120);
ALTER TABLE Factura ADD COLUMN IF NOT EXISTS factus_public_url TEXT;
ALTER TABLE Factura ADD COLUMN IF NOT EXISTS factus_qr_link TEXT;
ALTER TABLE Factura ADD COLUMN IF NOT EXISTS factus_status VARCHAR(20) DEFAULT 'pending';
-- factus_status: 'pending' | 'validated' | 'failed' | 'credit_noted'

-- Estatus fiscal del producto al momento de la venta
-- Valores: '19' (IVA 19%), 'EXENTO' (tarifa 0%), 'EXCLUIDO' (sin IVA)
ALTER TABLE Producto_Venta ADD COLUMN IF NOT EXISTS tax_status VARCHAR(10) DEFAULT '19';

-- Down Migration
-- ALTER TABLE Factura DROP COLUMN IF EXISTS factus_cufe;
-- ALTER TABLE Factura DROP COLUMN IF EXISTS factus_public_url;
-- ALTER TABLE Factura DROP COLUMN IF EXISTS factus_qr_link;
-- ALTER TABLE Factura DROP COLUMN IF EXISTS factus_status;
-- ALTER TABLE Producto_Venta DROP COLUMN IF EXISTS tax_status;
