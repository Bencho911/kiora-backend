-- Schema export for orders-service

-- Migration: 001_schema_inicial
-- Dominio: orders-service
-- Tablas de ventas y facturación.
--
-- NOTAS sobre FK cruzadas eliminadas:
--   · Factura.fk_id_usu apuntaba a Cliente (users-service).
--     Ahora es un INT plano; la validación ocurre vía HTTP.
--   · Producto_Venta.fk_cod_prod1 apuntaba a Producto (products-service).
--     Ídem.

-- Up Migration
CREATE TABLE IF NOT EXISTS Ventas (
    id_vent           SERIAL PRIMARY KEY,
    fecha_vent        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    precio_prod_final DECIMAL(10, 2) NOT NULL CHECK (precio_prod_final >= 0),
    montofinal_vent   DECIMAL(10, 2) NOT NULL CHECK (montofinal_vent >= 0),
    metodopago_usu    VARCHAR(50),
    estado            VARCHAR(30)    NOT NULL DEFAULT 'pendiente'
    -- 'pendiente' | 'completada' | 'cancelada'
);

-- Líneas de detalle de venta (qué productos se vendieron)
-- cod_prod referencia a Producto en products-service (sin FK de BD)
CREATE TABLE IF NOT EXISTS Producto_Venta (
    id          SERIAL PRIMARY KEY,
    fk_id_vent  INT            NOT NULL REFERENCES Ventas(id_vent) ON DELETE CASCADE,
    cod_prod    INT            NOT NULL, -- ID del producto en products-service
    cantidad    INT            NOT NULL CHECK (cantidad > 0),
    precio_unit DECIMAL(10, 2) NOT NULL CHECK (precio_unit >= 0)
);

-- Factura asociada a una venta y a un cliente
-- fk_id_usu referencia a Cliente en users-service (sin FK de BD)
CREATE TABLE IF NOT EXISTS Factura (
    id              SERIAL PRIMARY KEY,
    fk_id_vent      INT            NOT NULL REFERENCES Ventas(id_vent) ON DELETE CASCADE,
    id_usu          INT            NOT NULL, -- ID del cliente en users-service
    cantidad_vent   INT            NOT NULL CHECK (cantidad_vent > 0),
    precio_prod     DECIMAL(10, 2) NOT NULL CHECK (precio_prod >= 0),
    montototal_vent DECIMAL(10, 2) NOT NULL CHECK (montototal_vent >= 0),
    emitida_en      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Down Migration
-- DROP TABLE IF EXISTS Factura;
-- DROP TABLE IF EXISTS Producto_Venta;
-- DROP TABLE IF EXISTS Ventas;


-- Migration: 002_add_indexes
-- Dominio: orders-service
-- Agregar índices en columnas de FK y filtro frecuente
-- para mejorar rendimiento de queries.

-- Up Migration
CREATE INDEX IF NOT EXISTS idx_producto_venta_fk_id_vent ON Producto_Venta(fk_id_vent);
CREATE INDEX IF NOT EXISTS idx_factura_fk_id_vent ON Factura(fk_id_vent);
CREATE INDEX IF NOT EXISTS idx_factura_id_usu ON Factura(id_usu);

-- Down Migration
-- DROP INDEX IF EXISTS idx_producto_venta_fk_id_vent;
-- DROP INDEX IF EXISTS idx_factura_fk_id_vent;
-- DROP INDEX IF EXISTS idx_factura_id_usu;


-- Migration: 003_add_outbox_events
-- Dominio: orders-service
-- Outbox Pattern: tabla de eventos para persistir Saga events
-- con soporte de reintentos inteligentes y DLQ.

-- Up Migration
CREATE TABLE IF NOT EXISTS outbox_events (
    id            SERIAL PRIMARY KEY,
    event_type    VARCHAR(50) NOT NULL,
    payload       JSONB NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count   INT NOT NULL DEFAULT 0,
    max_retries   INT NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMPTZ
);

-- Partial index: solo events pendientes listos para procesar
CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox_events(next_retry_at)
    WHERE status = 'pending';

-- Down Migration
-- DROP INDEX IF EXISTS idx_outbox_pending;
-- DROP TABLE IF EXISTS outbox_events;


-- Migration: 004_add_nom_prod_to_producto_venta
-- Dominio: orders-service
-- Agrega columna nom_prod a Producto_Venta para desnormalizar y facilitar historial.

-- Up Migration
ALTER TABLE Producto_Venta 
    ADD COLUMN IF NOT EXISTS nom_prod VARCHAR(255);

-- Down Migration
-- ALTER TABLE Producto_Venta DROP COLUMN IF EXISTS nom_prod;


