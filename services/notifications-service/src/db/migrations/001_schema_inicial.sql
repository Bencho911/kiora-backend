-- Migration: 001_schema_inicial
-- Dominio: notifications-service

-- Up Migration
CREATE TABLE IF NOT EXISTS Alerta (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL, -- ej: 'stock_bajo', 'vencimiento'
    mensaje TEXT NOT NULL,
    metadata JSONB,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Down Migration
-- DROP TABLE IF EXISTS Alerta;
