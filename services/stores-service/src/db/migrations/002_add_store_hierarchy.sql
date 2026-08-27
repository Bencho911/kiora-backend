-- Migration: 002_add_store_hierarchy
-- Dominio: stores-service

-- Up Migration
CREATE TABLE IF NOT EXISTS Regional (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Ciudad (
    id SERIAL PRIMARY KEY,
    fk_regional_id INT NOT NULL REFERENCES Regional(id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fk_regional_id, nombre)
);

-- Añadimos la columna fk_ciudad_id a Tienda, permitiendo nulos temporalmente
-- para no quebrar las tiendas existentes
ALTER TABLE Tienda ADD COLUMN fk_ciudad_id INT REFERENCES Ciudad(id) ON DELETE SET NULL;

-- Insertar datos por defecto para mantener compatibilidad
INSERT INTO Regional (id, nombre) VALUES (1, 'Regional Principal') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO Ciudad (id, fk_regional_id, nombre) VALUES (1, 1, 'Ciudad Principal') ON CONFLICT (fk_regional_id, nombre) DO NOTHING;

-- Actualizar la tienda existente (Sede Principal) para que pertenezca a la ciudad por defecto
UPDATE Tienda SET fk_ciudad_id = 1 WHERE id_tienda = 1 AND fk_ciudad_id IS NULL;

-- Opcional: hacer que la columna sea NOT NULL si queremos forzar la jerarquía
-- ALTER TABLE Tienda ALTER COLUMN fk_ciudad_id SET NOT NULL;

-- Down Migration
-- ALTER TABLE Tienda DROP COLUMN IF EXISTS fk_ciudad_id;
-- DROP TABLE IF EXISTS Ciudad;
-- DROP TABLE IF EXISTS Regional;
