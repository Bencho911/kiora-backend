ALTER TABLE Producto ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_producto_codigo_barras ON Producto(codigo_barras);
