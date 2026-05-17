-- Schema export for users-service

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


-- Migration: 002_add_lock_policy
-- HU04: Política de bloqueo de cuenta
-- Agrega columnas de seguridad a la tabla Cliente

-- Up Migration
ALTER TABLE Cliente
    ADD COLUMN IF NOT EXISTS intentos_fallidos INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP NULL;

-- Down Migration
-- ALTER TABLE Cliente
--     DROP COLUMN IF EXISTS intentos_fallidos,
--     DROP COLUMN IF EXISTS bloqueado_hasta;


-- Migration: 003_add_activo_to_cliente
-- HU44: Soft delete de usuarios — la columna activo permite "eliminar" sin perder datos históricos

-- Up Migration
ALTER TABLE Cliente
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Down Migration
-- ALTER TABLE Cliente DROP COLUMN IF EXISTS activo;


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


-- Migration: 005_add_unique_email_cliente
-- Garantiza unicidad de correo en usuarios activos para evitar duplicados por carrera.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM Cliente
        WHERE activo = true
        GROUP BY lower(trim(correo_usu))
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'No se puede crear índice único: existen correos duplicados en usuarios activos.';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_correo_activo
ON Cliente (lower(trim(correo_usu)))
WHERE activo = true;


-- Migration: 006_add_session_version_to_cliente
-- Permite invalidar todos los JWT (access + refresh) al cambiar/restablecer contraseña.

ALTER TABLE Cliente
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;


-- Migration: 007_drop_unique_token_from_reset_tokens
-- Para OTP (códigos numéricos) no se debe imponer UNIQUE global a `reset_tokens.token`.
-- Esto evita colisiones cuando el mismo código se repite entre usuarios o en el tiempo.

ALTER TABLE reset_tokens
    DROP CONSTRAINT IF EXISTS reset_tokens_token_key;

-- (Opcional) aseguramos un índice para lookups rápidos por email+token
-- sin forzar unicidad.
CREATE INDEX IF NOT EXISTS ix_reset_tokens_id_usu_usado_expira
ON reset_tokens (id_usu, usado, expira_en);



-- Migration: 008_cleanup_non_user_tables
-- Dominio: users-service
-- Elimina tablas de otros dominios que fueron creadas por error en la
-- migración 001_schema_inicial. Cada tabla es responsabilidad del
-- servicio que la posee:
--   · Categoria, Producto      → products-service
--   · Proveedor, Inventario,
--     Suministra               → inventory-service
--   · Ventas, Producto_Venta,
--     Factura                  → orders-service
--
-- Las FK cruzadas entre dominios desaparecen: la consistencia se
-- mantiene a nivel de aplicación via llamadas HTTP entre servicios.

-- Up Migration
-- El orden importa: primero las tablas dependientes, luego las base.
DROP TABLE IF EXISTS Factura;
DROP TABLE IF EXISTS Producto_Venta;
DROP TABLE IF EXISTS Ventas;
DROP TABLE IF EXISTS Suministra;
DROP TABLE IF EXISTS Inventario;
DROP TABLE IF EXISTS Producto;
DROP TABLE IF EXISTS Proveedor;
DROP TABLE IF EXISTS Categoria;

-- Down Migration
-- No restauramos: estas tablas no pertenecen a este servicio.
-- Para un rollback real, ejecutar las migraciones iniciales del
-- servicio correspondiente (products-service, inventory-service,
-- orders-service).


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


