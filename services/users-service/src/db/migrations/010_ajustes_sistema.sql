-- Migration: 010_ajustes_sistema
-- Dominio: users-service (settings)
-- Configuración global del sistema.

-- Up Migration
CREATE TABLE IF NOT EXISTS ajustes_sistema (
    id SERIAL PRIMARY KEY,
    cierre_caja_automatico BOOLEAN NOT NULL DEFAULT true,
    hora_cierre_automatico VARCHAR(5) NOT NULL DEFAULT '03:00',
    abrir_siguiente_automatico BOOLEAN NOT NULL DEFAULT false,
    metodo_descuento_lote VARCHAR(10) NOT NULL DEFAULT 'FEFO',
    dias_alerta_vencimiento INT NOT NULL DEFAULT 30
);

-- Insertar configuración por defecto
INSERT INTO ajustes_sistema (id, cierre_caja_automatico, hora_cierre_automatico, abrir_siguiente_automatico, metodo_descuento_lote, dias_alerta_vencimiento)
VALUES (1, true, '03:00', false, 'FEFO', 30)
ON CONFLICT (id) DO NOTHING;

-- Down Migration
-- DROP TABLE IF EXISTS ajustes_sistema;
