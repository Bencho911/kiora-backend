-- Migration: 003_add_fk_cod_prov_inventario
-- Dominio: inventory-service
-- Añade columna fk_cod_prov a la tabla Inventario para trazabilidad
-- de entradas de mercancía por proveedor.

-- Up Migration
ALTER TABLE Inventario
    ADD COLUMN IF NOT EXISTS fk_cod_prov INTEGER REFERENCES Proveedor(cod_prov) ON DELETE SET NULL;

-- Down Migration
-- ALTER TABLE Inventario DROP COLUMN IF EXISTS fk_cod_prov;
