-- Migration: 007_rename_fk_cod_cat_to_fk_cod_cats
-- Dominio: products-service
-- Cambia la columna fk_cod_cat (FK individual) a fk_cod_cats (array de categorías).
-- Permite que un producto pertenezca a múltiples categorías.

-- Up Migration

-- 1. Eliminar la FK constraint existente
ALTER TABLE Producto DROP CONSTRAINT IF EXISTS producto_fk_cod_cat_fkey;

-- 2. Renombrar la columna
ALTER TABLE Producto RENAME COLUMN fk_cod_cat TO fk_cod_cats_old;

-- 3. Agregar nueva columna tipo array
ALTER TABLE Producto ADD COLUMN IF NOT EXISTS fk_cod_cats INTEGER[] DEFAULT '{}';

-- 4. Migrar datos existentes: convertir el valor individual a array
UPDATE Producto
SET fk_cod_cats = ARRAY[fk_cod_cats_old]
WHERE fk_cod_cats_old IS NOT NULL;

-- 5. Eliminar la columna vieja
ALTER TABLE Producto DROP COLUMN IF EXISTS fk_cod_cats_old;

-- Down Migration
-- ALTER TABLE Producto ADD COLUMN fk_cod_cat INT;
-- UPDATE Producto SET fk_cod_cat = fk_cod_cats[1] WHERE array_length(fk_cod_cats, 1) > 0;
-- ALTER TABLE Producto DROP COLUMN fk_cod_cats;
-- ALTER TABLE Producto ADD CONSTRAINT producto_fk_cod_cat_fkey FOREIGN KEY (fk_cod_cat) REFERENCES Categoria(cod_cat) ON DELETE SET NULL;
