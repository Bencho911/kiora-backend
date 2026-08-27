-- Migration: 011_add_store_id_to_inventory
-- Dominio: inventory-service
-- Añade el contexto de tienda a los movimientos de inventario y lotes.
--
-- ESTRATEGIA NO DESTRUCTIVA:
-- 1. Añadimos store_id con DEFAULT 1 (Sede Principal) en ambas tablas.
--    Todos los registros históricos quedan asignados automáticamente a la sede.
-- 2. El operario siempre tendrá su sesión de caja vinculada a una tienda,
--    por lo que todo movimiento futuro llevará el store_id correcto.
-- 3. store_id referencia Tienda.id_tienda en stores-service (otro dominio).
--    La consistencia se garantiza a nivel de aplicación, no con FK cruzadas.

-- Up Migration

-- 1. Movimientos de inventario (tabla Inventario) → saber desde qué tienda se registró
ALTER TABLE Inventario
    ADD COLUMN IF NOT EXISTS store_id INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN Inventario.store_id IS
    'Tienda desde la que se registró el movimiento. Referencia Tienda.id_tienda en stores-service.';

-- 2. Lotes → saber en qué bodega/tienda está físicamente el lote
ALTER TABLE lotes
    ADD COLUMN IF NOT EXISTS store_id INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN lotes.store_id IS
    'Tienda (bodega) donde está almacenado el lote. Referencia Tienda.id_tienda en stores-service.';

-- 3. Índices para consultas frecuentes por tienda
CREATE INDEX IF NOT EXISTS idx_inventario_store ON Inventario(store_id);
CREATE INDEX IF NOT EXISTS idx_lotes_store      ON lotes(store_id);

-- Down Migration
-- ALTER TABLE Inventario DROP COLUMN IF EXISTS store_id;
-- ALTER TABLE lotes DROP COLUMN IF EXISTS store_id;
-- DROP INDEX IF EXISTS idx_inventario_store;
-- DROP INDEX IF EXISTS idx_lotes_store;

