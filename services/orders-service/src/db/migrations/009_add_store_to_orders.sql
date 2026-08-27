-- Migration: 009_add_store_to_orders
-- Dominio: orders-service
-- Añade el contexto de tienda y tipo de entrega a las ventas y sesiones de caja.

-- Up Migration

-- 1. Añadir store_id a sesion_caja
-- El default 1 asigna todas las sesiones históricas a la sede principal
ALTER TABLE sesion_caja
    ADD COLUMN IF NOT EXISTS store_id INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN sesion_caja.store_id IS
    'Tienda en la que se abrió esta sesión de caja (Referencia a Tienda.id_tienda)';

-- 2. Añadir campos a la tabla ventas
ALTER TABLE ventas
    ADD COLUMN IF NOT EXISTS store_id INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS tipo_entrega VARCHAR(20) NOT NULL DEFAULT 'PICKUP' CHECK (tipo_entrega IN ('PICKUP', 'MESA')),
    ADD COLUMN IF NOT EXISTS fk_id_mesa INTEGER;

COMMENT ON COLUMN ventas.store_id IS
    'Tienda donde se realizó la venta (Referencia a Tienda.id_tienda)';
COMMENT ON COLUMN ventas.tipo_entrega IS
    'Tipo de entrega: PICKUP o MESA. (Domicilios no existen)';
COMMENT ON COLUMN ventas.fk_id_mesa IS
    'Si tipo_entrega es MESA, indica en qué mesa está el cliente (Referencia a Mesa.id_mesa)';

-- 3. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_sesion_caja_store ON sesion_caja(store_id);
CREATE INDEX IF NOT EXISTS idx_ventas_store ON ventas(store_id);
CREATE INDEX IF NOT EXISTS idx_ventas_mesa ON ventas(fk_id_mesa);

-- Down Migration
-- ALTER TABLE sesion_caja DROP COLUMN IF EXISTS store_id;
-- ALTER TABLE ventas DROP COLUMN IF EXISTS store_id, DROP COLUMN IF EXISTS tipo_entrega, DROP COLUMN IF EXISTS fk_id_mesa;
-- DROP INDEX IF EXISTS idx_sesion_caja_store;
-- DROP INDEX IF EXISTS idx_ventas_store;
-- DROP INDEX IF EXISTS idx_ventas_mesa;
