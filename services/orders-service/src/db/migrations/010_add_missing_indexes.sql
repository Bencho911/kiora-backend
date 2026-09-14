-- 010_add_missing_indexes.sql
-- Optimización de queries frecuentes de reportes y validaciones de caja

CREATE INDEX IF NOT EXISTS idx_ventas_fecha_estado ON ventas (fecha_vent, estado);
CREATE INDEX IF NOT EXISTS idx_sesion_caja_estado_store ON sesion_caja (estado, store_id);
