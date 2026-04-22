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
