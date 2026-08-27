-- Migration: 012_add_rbac_scopes
-- Dominio: users-service
-- Añade los campos para control de acceso basado en roles jerárquicos (RBAC).

-- Up Migration
ALTER TABLE Cliente 
    ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS scope_id INTEGER;

COMMENT ON COLUMN Cliente.scope_type IS 'Ámbito de acceso: GLOBAL, REGIONAL, TIENDA o nulo para clientes';
COMMENT ON COLUMN Cliente.scope_id IS 'ID de la Regional o Tienda asignada según el scope_type';

-- Ajustar los roles existentes
-- Asumimos que los que eran 'admin' ahora son globales (superadmins) 
-- y los 'cliente' pasan a ser 'customer' (o se mantienen pero los validaremos como customer en código)
UPDATE Cliente SET rol_usu = 'customer' WHERE rol_usu = 'cliente';

-- Down Migration
-- ALTER TABLE Cliente DROP COLUMN IF EXISTS scope_type;
-- ALTER TABLE Cliente DROP COLUMN IF EXISTS scope_id;
-- UPDATE Cliente SET rol_usu = 'cliente' WHERE rol_usu = 'customer';
