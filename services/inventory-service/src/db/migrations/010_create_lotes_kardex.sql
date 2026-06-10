-- Migration: 010_create_lotes_kardex
-- Dominio: inventory-service
-- Crea el sistema real de lotes y Kardex (movimientos por lote).

-- Up Migration
CREATE TABLE IF NOT EXISTS lotes (
    id SERIAL PRIMARY KEY,
    cod_prod INT NOT NULL,
    numero_lote VARCHAR(50) NOT NULL,
    fecha_vencimiento DATE,
    cantidad_inicial DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cantidad_actual DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    fecha_ingreso TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'ACTIVO' -- ACTIVO, AGOTADO, VENCIDO
);

-- Para búsquedas rápidas de lotes con inventario por FEFO/FIFO
CREATE INDEX idx_lotes_prod_vencimiento ON lotes(cod_prod, fecha_vencimiento ASC) WHERE estado = 'ACTIVO';

CREATE TABLE IF NOT EXISTS movimientos_lote (
    id SERIAL PRIMARY KEY,
    lote_id INT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
    tipo_mov VARCHAR(20) NOT NULL, -- 'entrada', 'salida'
    cantidad DECIMAL(10, 2) NOT NULL,
    fecha_mov TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fk_id_vent INT, -- Nullable, referencia débil a Ventas (órdenes)
    desc_mov TEXT
);

-- Migración de datos legacy (Crear un lote "Histórico" por cada producto con stock en Suministra)
-- Tomamos el stock de la tabla Suministra y lo metemos como un lote por defecto
INSERT INTO lotes (cod_prod, numero_lote, fecha_vencimiento, cantidad_inicial, cantidad_actual)
SELECT 
    s.cod_prod, 
    'LOTE-LEGACY-01', 
    NULL, 
    s.stock, 
    s.stock
FROM Suministra s
WHERE s.stock > 0;

-- Down Migration
-- DROP TABLE IF EXISTS movimientos_lote;
-- DROP INDEX IF EXISTS idx_lotes_prod_vencimiento;
-- DROP TABLE IF EXISTS lotes;
