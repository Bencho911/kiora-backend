-- Migration: 006_add_factus_invoice_number
-- Dominio: orders-service
-- Almacena el numero de factura electronica emitida por Factus
-- para poder anularla fiscalmente si es necesario.

-- Up Migration
ALTER TABLE Factura ADD COLUMN IF NOT EXISTS factus_invoice_number VARCHAR(50);

-- Down Migration
-- ALTER TABLE Factura DROP COLUMN IF EXISTS factus_invoice_number;
