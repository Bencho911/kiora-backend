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
