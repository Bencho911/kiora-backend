-- Migration: 001_schema_inicial
-- Dominio: products-service
-- Tablas del catálogo de productos: categorías y productos.
--
-- NOTA: Las FK cruzadas con otros dominios (inventario, órdenes)
-- no existen aquí — la consistencia se mantiene a nivel de aplicación.

-- Up Migration
CREATE TABLE IF NOT EXISTS Categoria (
    cod_cat     SERIAL PRIMARY KEY,
    nom_cat     VARCHAR(40)  NOT NULL,
    descrip_cat TEXT
);

CREATE TABLE IF NOT EXISTS Producto (
    cod_prod        SERIAL PRIMARY KEY,
    nom_prod        VARCHAR(100)   NOT NULL,
    descrip_prod    TEXT,
    precio_unitario DECIMAL(10, 2) NOT NULL CHECK (precio_unitario >= 0),
    fechaven_prod   DATE,
    -- FK local: categoría está en este mismo servicio
    fk_cod_cat      INT REFERENCES Categoria(cod_cat) ON DELETE SET NULL
);

-- Down Migration
-- DROP TABLE IF EXISTS Producto;
-- DROP TABLE IF EXISTS Categoria;
