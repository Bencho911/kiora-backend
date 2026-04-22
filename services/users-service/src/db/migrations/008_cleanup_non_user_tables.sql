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
