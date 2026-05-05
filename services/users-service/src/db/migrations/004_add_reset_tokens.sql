-- Migration: 004_add_reset_tokens
-- HU05: Recuperación de contraseña — tabla de tokens temporales

-- Up Migration
CREATE TABLE IF NOT EXISTS reset_tokens (
    id        SERIAL PRIMARY KEY,
    id_usu    INT NOT NULL REFERENCES Cliente(id_usu),
    token     VARCHAR(255) NOT NULL UNIQUE,
    expira_en TIMESTAMP NOT NULL,
    usado     BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Down Migration
-- DROP TABLE IF EXISTS reset_tokens;
