-- Migration: 009_incidencias_schema
-- Dominio: users-service
-- Añade tabla ReporteFallo para soporte interno.

-- Up Migration
CREATE TABLE IF NOT EXISTS ReporteFallo (
    id_rep SERIAL PRIMARY KEY,
    descripcion TEXT NOT NULL,
    prioridad VARCHAR(20) DEFAULT 'media',
    estado VARCHAR(20) DEFAULT 'pendiente',
    fk_id_usu INTEGER NOT NULL REFERENCES Cliente(id_usu) ON DELETE CASCADE,
    cod_prod INTEGER NULL,
    fecha_rep TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones_tecnicas TEXT NULL,
    titulo TEXT NULL
);

-- Down Migration
-- DROP TABLE IF EXISTS ReporteFallo;
