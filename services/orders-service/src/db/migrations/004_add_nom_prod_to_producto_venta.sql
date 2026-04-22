-- Migration: 002_add_nom_prod_to_producto_venta
-- Dominio: orders-service
-- Agrega columna nom_prod a Producto_Venta para desnormalizar y facilitar historial.

-- Up Migration
ALTER TABLE Producto_Venta 
    ADD COLUMN IF NOT EXISTS nom_prod VARCHAR(255);

-- Down Migration
-- ALTER TABLE Producto_Venta DROP COLUMN IF EXISTS nom_prod;
