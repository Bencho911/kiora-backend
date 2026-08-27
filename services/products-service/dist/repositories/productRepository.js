"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProductTienda = exports.updateStockByStore = exports.findByIdAndStore = exports.countAllByStore = exports.findAllByStore = exports.findLowStock = exports.remove = exports.updateStock = exports.update = exports.create = exports.findByBarcode = exports.findByName = exports.findById = exports.countAll = exports.findAll = void 0;
const db_1 = __importDefault(require("../config/db"));
const findAll = ({ limit = 20, offset = 0 } = {}) => db_1.default.query(`SELECT p.cod_prod, p.nom_prod, p.descrip_prod,
                p.precio_base_sugerido AS precio_unitario,
                p.fechaven_prod, p.fk_cod_cats,
                p.stock_actual, p.stock_minimo, p.url_imagen, p.descuento, p.codigo_barras
         FROM Producto p
         WHERE p.activo = true
         ORDER BY p.cod_prod
         LIMIT $1 OFFSET $2`, [limit, offset]);
exports.findAll = findAll;
const countAll = () => db_1.default.query('SELECT COUNT(*) FROM Producto WHERE activo = true');
exports.countAll = countAll;
const findById = (cod_prod) => db_1.default.query(`SELECT p.cod_prod, p.nom_prod, p.descrip_prod,
                p.precio_base_sugerido AS precio_unitario,
                p.fechaven_prod, p.fk_cod_cats,
                p.stock_actual, p.stock_minimo, p.url_imagen, p.descuento, p.codigo_barras
         FROM Producto p
         WHERE p.cod_prod = $1`, [cod_prod]);
exports.findById = findById;
const findByName = (nom_prod) => db_1.default.query(`SELECT cod_prod, nom_prod
         FROM Producto
         WHERE LOWER(nom_prod) = LOWER($1) AND activo = true`, [nom_prod]);
exports.findByName = findByName;
const findByBarcode = (codigo_barras) => db_1.default.query(`SELECT cod_prod, codigo_barras
         FROM Producto
         WHERE codigo_barras = $1 AND activo = true`, [codigo_barras]);
exports.findByBarcode = findByBarcode;
const create = ({ nom_prod, descrip_prod, precio_unitario, descuento, fechaven_prod, fk_cod_cats, stock_actual, stock_minimo, url_imagen, codigo_barras }) => db_1.default.query(`INSERT INTO Producto (nom_prod, descrip_prod, precio_base_sugerido, descuento, fechaven_prod, fk_cod_cats, stock_actual, stock_minimo, url_imagen, codigo_barras)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *, precio_base_sugerido AS precio_unitario`, [nom_prod, descrip_prod || null, precio_unitario, descuento ?? 0, fechaven_prod || null, fk_cod_cats || [], stock_actual ?? 0, stock_minimo ?? 0, url_imagen || null, codigo_barras || null]);
exports.create = create;
const update = (cod_prod, fields) => {
    const fieldMap = { precio_unitario: 'precio_base_sugerido' };
    const allowed = ['nom_prod', 'descrip_prod', 'precio_unitario', 'descuento', 'fechaven_prod', 'fk_cod_cats', 'stock_actual', 'stock_minimo', 'url_imagen', 'codigo_barras'];
    const entries = Object.entries(fields)
        .filter(([key]) => allowed.includes(key))
        .map(([key, val]) => [fieldMap[key] || key, val]);
    if (entries.length === 0)
        return Promise.resolve({ rows: [] });
    const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
    return db_1.default.query(`UPDATE Producto SET ${setClauses}
         WHERE cod_prod = $${entries.length + 1}
         RETURNING *, precio_base_sugerido AS precio_unitario`, [...entries.map(([, val]) => val), cod_prod]);
};
exports.update = update;
const updateStock = (cod_prod, cantidad) => db_1.default.query(`UPDATE Producto
         SET stock_actual = stock_actual + $1
         WHERE cod_prod = $2
         RETURNING *`, [cantidad, cod_prod]);
exports.updateStock = updateStock;
const remove = (cod_prod) => db_1.default.query('UPDATE Producto SET activo = false WHERE cod_prod = $1 AND activo = true RETURNING cod_prod', [cod_prod]);
exports.remove = remove;
const findLowStock = () => db_1.default.query(`SELECT p.cod_prod, p.nom_prod, p.stock_actual, p.stock_minimo, p.fk_cod_cats
         FROM Producto p
         WHERE p.stock_actual <= p.stock_minimo AND p.activo = true
         ORDER BY p.cod_prod`);
exports.findLowStock = findLowStock;
const findAllByStore = ({ storeId, limit = 20, offset = 0 } = {}) => db_1.default.query(`SELECT
            p.cod_prod, p.nom_prod, p.descrip_prod, p.precio_base_sugerido,
            p.fechaven_prod, p.fk_cod_cats, p.url_imagen, p.descuento, p.codigo_barras,
            p.stock_minimo,
            pt.precio_venta,
            pt.stock_actual,
            pt.store_id,
            pt.activo AS activo_en_tienda
         FROM Producto p
         INNER JOIN Producto_Tienda pt ON pt.fk_cod_prod = p.cod_prod
         WHERE p.activo = true
           AND pt.store_id = $1
           AND pt.activo = true
           AND pt.stock_actual > 0
         ORDER BY p.cod_prod
         LIMIT $2 OFFSET $3`, [storeId, limit, offset]);
exports.findAllByStore = findAllByStore;
const countAllByStore = (storeId) => db_1.default.query(`SELECT COUNT(*)
         FROM Producto p
         INNER JOIN Producto_Tienda pt ON pt.fk_cod_prod = p.cod_prod
         WHERE p.activo = true AND pt.store_id = $1 AND pt.activo = true AND pt.stock_actual > 0`, [storeId]);
exports.countAllByStore = countAllByStore;
const findByIdAndStore = (cod_prod, storeId) => db_1.default.query(`SELECT
            p.cod_prod, p.nom_prod, p.descrip_prod, p.precio_base_sugerido,
            p.fechaven_prod, p.fk_cod_cats, p.url_imagen, p.descuento, p.codigo_barras,
            p.stock_minimo,
            pt.precio_venta,
            pt.stock_actual,
            pt.store_id,
            pt.activo AS activo_en_tienda
         FROM Producto p
         INNER JOIN Producto_Tienda pt ON pt.fk_cod_prod = p.cod_prod
         WHERE p.cod_prod = $1 AND pt.store_id = $2`, [cod_prod, storeId]);
exports.findByIdAndStore = findByIdAndStore;
const updateStockByStore = (cod_prod, storeId, cantidad) => db_1.default.query(`UPDATE Producto_Tienda
         SET stock_actual = stock_actual + $1
         WHERE fk_cod_prod = $2 AND store_id = $3
         RETURNING *`, [cantidad, cod_prod, storeId]);
exports.updateStockByStore = updateStockByStore;
const createProductTienda = ({ cod_prod, storeId, precio_venta, stock_actual = 0 }) => db_1.default.query(`INSERT INTO Producto_Tienda (fk_cod_prod, store_id, precio_venta, stock_actual)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (fk_cod_prod, store_id)
         DO UPDATE SET precio_venta = EXCLUDED.precio_venta, stock_actual = EXCLUDED.stock_actual, activo = true
         RETURNING *`, [cod_prod, storeId, precio_venta, stock_actual]);
exports.createProductTienda = createProductTienda;
