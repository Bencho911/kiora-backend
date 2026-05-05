-- Migration: 001_schema_inicial
-- Dominio: users-service
-- Crea la tabla base de usuarios del sistema Kiora.
--
-- NOTA: Las tablas de otros dominios (productos, inventario, órdenes)
-- son creadas por sus respectivos servicios. No agregar tablas de
-- otros dominios aquí.

-- Up Migration
CREATE TABLE IF NOT EXISTS Cliente (
    id_usu       SERIAL PRIMARY KEY,
    nom_usu      VARCHAR(60),
    correo_usu   VARCHAR(100),
    password_usu VARCHAR(255), -- bcrypt hash, nunca texto plano
    rol_usu      VARCHAR(30),  -- 'admin' | 'cliente'
    tel_usu      VARCHAR(20)
);

-- Down Migration
-- DROP TABLE IF EXISTS Cliente;
