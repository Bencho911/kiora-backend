-- Migration: 008_create_producto_tienda
-- Dominio: products-service
-- Introduce el modelo Multi-Tienda para Catálogo y Precios.
--
-- ESTRATEGIA NO DESTRUCTIVA:
-- 1. Creamos la tabla Producto_Tienda para almacenar precio y stock por sede.
-- 2. Migramos todos los datos actuales (precio y stock) a la Tienda 1 (Sede Principal).
-- 3. Renombramos precio_unitario a precio_base_sugerido (referencia global, no se borra).
-- 4. stock_actual en Producto queda deprecated (se mantiene para compatibilidad hasta Fase 3).
--
-- NOTA: El store_id referencia la tabla Tienda en stores-service (otro dominio).
-- La consistencia se garantiza a nivel de aplicación, no con FK cruzadas.

-- Up Migration

-- 1. Tabla Producto_Tienda: precio y stock independiente por sede
CREATE TABLE IF NOT EXISTS Producto_Tienda (
    id              SERIAL PRIMARY KEY,
    fk_cod_prod     INT     NOT NULL REFERENCES Producto(cod_prod) ON DELETE CASCADE,
    store_id        INT     NOT NULL,          -- Referencia a Tienda.id_tienda en stores-service
    precio_venta    DECIMAL(10, 2) NOT NULL CHECK (precio_venta >= 0),
    stock_actual    INTEGER NOT NULL DEFAULT 0 CHECK (stock_actual >= -1),  -- -1 permitido transitoriamente por reservas
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fk_cod_prod, store_id)  -- Un producto aparece una sola vez por tienda
);

-- Índice para búsquedas frecuentes por tienda
CREATE INDEX IF NOT EXISTS idx_producto_tienda_store ON Producto_Tienda(store_id);
CREATE INDEX IF NOT EXISTS idx_producto_tienda_prod  ON Producto_Tienda(fk_cod_prod);

-- 2. Migrar datos actuales → Tienda 1 (Sede Principal)
-- Todos los productos existentes pasan a estar disponibles en la sede única actual.
INSERT INTO Producto_Tienda (fk_cod_prod, store_id, precio_venta, stock_actual, activo)
SELECT
    cod_prod,
    1                       AS store_id,          -- Sede Principal (id = 1 en stores-service)
    precio_unitario         AS precio_venta,
    COALESCE(stock_actual, 0) AS stock_actual,
    COALESCE(activo, TRUE)  AS activo
FROM Producto
ON CONFLICT (fk_cod_prod, store_id) DO NOTHING;

-- 3. Renombrar precio_unitario → precio_base_sugerido (precio de referencia global, no por tienda)
ALTER TABLE Producto RENAME COLUMN precio_unitario TO precio_base_sugerido;

-- 4. Añadir columna de comentario para marcar stock_actual en Producto como deprecated
COMMENT ON COLUMN Producto.stock_actual IS 'DEPRECATED: Usar Producto_Tienda.stock_actual. Mantenido por compatibilidad hasta Fase 3.';

-- Down Migration
-- ALTER TABLE Producto RENAME COLUMN precio_base_sugerido TO precio_unitario;
-- DROP TABLE IF EXISTS Producto_Tienda;
