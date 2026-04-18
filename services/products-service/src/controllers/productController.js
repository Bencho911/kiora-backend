'use strict';

const productRepository = require('../repositories/productRepository');
const logger = require('../config/logger');

/**
 * Orquesta la lógica de negocio del catálogo de productos.
 * HU10 — createProduct
 * HU11 — updateProduct
 * HU12 — getProducts
 * HU13 — deleteProduct
 * HU15 — getProductById
 */

// GET /api/products  (HU12)
const getProducts = async (req, res, next) => {
    try {
        const page   = Math.max(1, parseInt(req.query.page  || 1, 10));
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || 20, 10)));
        const offset = (page - 1) * limit;

        const [rows, count] = await Promise.all([
            productRepository.findAll({ limit, offset }),
            productRepository.countAll(),
        ]);
        res.status(200).json({
            data: rows.rows,
            pagination: {
                total: parseInt(count.rows[0].count, 10),
                page,
                limit,
                totalPages: Math.ceil(count.rows[0].count / limit),
            }
        });
    } catch (error) {
        logger.error('Error al obtener productos', { error: error.message });
        next(error);
    }
};

// GET /api/products/:id  (HU15)
const getProductById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await productRepository.findById(id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error('Error al obtener producto', { error: error.message });
        next(error);
    }
};

// POST /api/products  (HU10)
const createProduct = async (req, res, next) => {
    const { nom_prod, descrip_prod, precio_unitario, fechaven_prod, fk_cod_cat, stock_actual, stock_minimo } = req.body;
    const url_imagen = req.file ? req.file.path : null;

    try {
        const result = await productRepository.create({
            nom_prod, 
            descrip_prod: descrip_prod || null, 
            precio_unitario: Number(precio_unitario), 
            fechaven_prod: fechaven_prod || null, 
            fk_cod_cat: (fk_cod_cat && fk_cod_cat !== '' && fk_cod_cat !== 'null') ? Number(fk_cod_cat) : null, 
            stock_actual: Number(stock_actual || 0), 
            stock_minimo: Number(stock_minimo || 0),
            url_imagen
        });
        logger.info('Producto creado', { cod_prod: result.rows[0].cod_prod });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: `La categoría con id ${fk_cod_cat} no existe.`, code: 'FK_NOT_FOUND' });
        }
        logger.error('Error al crear producto', { error: error.message });
        next(error);
    }
};

// PUT /api/products/:id  (HU11)
const updateProduct = async (req, res, next) => {
    const { id } = req.params;
    const productId = Number(id);

    try {
        const fields = { ...req.body };
        
        // Asignar URL de la imagen de Cloudinary si se subió una
        if (req.file && req.file.path) {
            fields.url_imagen = req.file.path;
        }

        // Conversión manual de tipos (FormData envía strings)
        if (fields.precio_unitario !== undefined) fields.precio_unitario = Number(fields.precio_unitario);
        if (fields.fk_cod_cat !== undefined) fields.fk_cod_cat = Number(fields.fk_cod_cat);
        if (fields.stock_actual !== undefined) fields.stock_actual = Number(fields.stock_actual);
        if (fields.stock_minimo !== undefined) fields.stock_minimo = Number(fields.stock_minimo);

        const result = await productRepository.update(productId, fields);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado o ningún campo válido enviado.', code: 'NOT_FOUND' });
        }
        logger.info('Producto actualizado', { cod_prod: id });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: `La categoría con id ${req.body.fk_cod_cat} no existe.`, code: 'FK_NOT_FOUND' });
        }
        logger.error('Error al actualizar producto', { error: error.message });
        next(error);
    }
};

// DELETE /api/products/:id  (HU13)
const deleteProduct = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await productRepository.remove(id);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        logger.info('Producto eliminado', { cod_prod: id });
        res.status(200).json({ message: 'Producto eliminado exitosamente.' });
    } catch (error) {
        logger.error('Error al eliminar producto', { error: error.message });
        next(error);
    }
};

// PUT /api/products/:id/stock — Actualizar stock del producto
const updateStock = async (req, res, next) => {
    const { id } = req.params;
    const { cantidad } = req.body;

    try {
        // Pre-validación: verificar que el stock no quede negativo
        if (Number(cantidad) < 0) {
            const current = await productRepository.findById(id);
            if (current.rows.length === 0) {
                return res.status(404).json({ error: 'Producto no encontrado.' });
            }
            const proyectado = current.rows[0].stock_actual + Number(cantidad);
            if (proyectado < 0) {
                return res.status(409).json({
                    error: 'Stock insuficiente.',
                    stock_actual: current.rows[0].stock_actual,
                    cantidad_solicitada: Number(cantidad),
                    mensaje: `⚠️ No se puede restar ${Math.abs(Number(cantidad))} unidades. Stock actual: ${current.rows[0].stock_actual}.`,
                });
            }
        }

        const result = await productRepository.updateStock(id, Number(cantidad));
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        const producto = result.rows[0];
        logger.info('Stock actualizado', { cod_prod: id, stock_actual: producto.stock_actual });

        // Alerta de stock crítico
        const alertaStockCritico = producto.stock_actual <= producto.stock_minimo;
        if (alertaStockCritico) {
            logger.warn('ALERTA: Stock crítico', {
                cod_prod: id,
                stock_actual: producto.stock_actual,
                stock_minimo: producto.stock_minimo,
            });
        }

        res.status(200).json({
            ...producto,
            alerta_stock_critico: alertaStockCritico,
            mensaje: alertaStockCritico
                ? `⚠️ Stock actual (${producto.stock_actual}) es menor o igual al mínimo configurado (${producto.stock_minimo}).`
                : undefined,
        });
    } catch (error) {
        // Constraint de BD: chk_stock_actual_no_negativo
        if (error.code === '23514' && error.constraint === 'chk_stock_actual_no_negativo') {
            return res.status(409).json({
                error: 'Stock insuficiente.',
                mensaje: 'La operación dejaría el stock en negativo.',
            });
        }
        logger.error('Error al actualizar stock', { error: error.message });
        next(error);
    }
};

// GET /api/products/low-stock
const getLowStock = async (req, res, next) => {
    try {
        const result = await productRepository.findLowStock();
        res.status(200).json({ data: result.rows });
    } catch (error) {
        logger.error('Error al obtener productos con bajo stock', { error: error.message });
        next(error);
    }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct, updateStock, getLowStock };
