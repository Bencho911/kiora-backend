-- Migration: 001_schema_inicial
-- Dominio: inventory-service
-- Tablas de inventario: proveedores, movimientos de stock y suministros.
--
-- NOTAS sobre FK cruzadas eliminadas:
--   · Inventario.fk_cod_prod apuntaba a Producto (products-service).
--     Ahora es un INT plano; la validación ocurre vía HTTP al registrar
--     un movimiento.
--   · Suministra.fk_cod_prod2 ídem.

-- Up Migration
CREATE TABLE IF NOT EXISTS Proveedor (
    cod_prov    SERIAL PRIMARY KEY,
    id_prov     VARCHAR(50),
    nom_prov    VARCHAR(100) NOT NULL,
    tel_prov    VARCHAR(20),
    tipoid_prov VARCHAR(20)
);

-- Movimientos de stock (entradas / salidas)
CREATE TABLE IF NOT EXISTS Inventario (
    id_mov    SERIAL PRIMARY KEY,
    tipo_mov  VARCHAR(50) NOT NULL, -- 'entrada' | 'salida' | 'ajuste'
    fecha_mov DATE        NOT NULL DEFAULT CURRENT_DATE,
    cantidad  INT         NOT NULL CHECK (cantidad > 0),
    -- referencia al producto en products-service (sin FK de BD)
    cod_prod  INT         NOT NULL
);

-- Relación proveedor → producto con stock actual disponible
CREATE TABLE IF NOT EXISTS Suministra (
    id         SERIAL PRIMARY KEY,
    fk_cod_prov INT NOT NULL REFERENCES Proveedor(cod_prov) ON DELETE CASCADE,
    -- referencia al producto en products-service (sin FK de BD)
    cod_prod   INT NOT NULL,
    stock      INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    UNIQUE (fk_cod_prov, cod_prod)
);

-- Down Migration
-- DROP TABLE IF EXISTS Suministra;
-- DROP TABLE IF EXISTS Inventario;
-- DROP TABLE IF EXISTS Proveedor;
