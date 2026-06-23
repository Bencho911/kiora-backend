-- Migration: 008_create_sesiones_caja
-- Dominio: orders-service
-- Crea la tabla de Sesion_Caja y asocia las Ventas a una sesión.

-- Up Migration
CREATE TABLE IF NOT EXISTS sesion_caja (
    id SERIAL PRIMARY KEY,
    hora_apertura TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hora_cierre TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
    total_ventas DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    usuario_id INT -- ID del administrador que abrió/cerró la caja (users-service)
);

ALTER TABLE Ventas
ADD COLUMN sesion_id INT REFERENCES sesion_caja(id) ON DELETE SET NULL;

-- Para las ventas existentes (migración de datos legacy), creamos una Sesión "Histórica" (Sesión 1) y le asignamos todas las ventas.
INSERT INTO sesion_caja (id, hora_apertura, hora_cierre, estado, total_ventas, usuario_id)
VALUES (1, '2023-01-01 00:00:00', CURRENT_TIMESTAMP, 'CERRADA', (SELECT COALESCE(SUM(montofinal_vent), 0) FROM Ventas), 1)
ON CONFLICT (id) DO NOTHING;

-- Asegurar que id sequence avance si forzamos el ID 1
SELECT setval('sesion_caja_id_seq', (SELECT MAX(id) FROM sesion_caja));

-- Asignar todas las ventas legacy a la sesión histórica
UPDATE Ventas SET sesion_id = 1 WHERE sesion_id IS NULL;

-- Opcional: Hacer sesion_id obligatoria para futuras ventas (si queremos forzarlo)
-- ALTER TABLE Ventas ALTER COLUMN sesion_id SET NOT NULL;

-- Down Migration
-- ALTER TABLE Ventas DROP COLUMN IF EXISTS sesion_id;
-- DROP TABLE IF EXISTS sesion_caja;
