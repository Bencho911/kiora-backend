-- Migration: 001_schema_inicial
-- Dominio: notifications-service

-- Up Migration
CREATE TABLE IF NOT EXISTS Alerta (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL, -- 'stock_bajo', 'vencimiento', etc.
    mensaje TEXT NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_alerta_leida ON Alerta(leida);
CREATE INDEX idx_alerta_fecha ON Alerta(fecha_creacion DESC);

-- Down Migration
-- DROP TABLE IF EXISTS Alerta;
