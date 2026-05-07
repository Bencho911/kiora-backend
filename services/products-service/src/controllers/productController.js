'use strict';

const productRepository = require('../repositories/productRepository');
const cacheService = require('../services/cacheService');
const parsePagination = require('../utils/parsePagination');
const logger = require('../config/logger');

/**
 * productController
 * Orquesta request → cache/repository → response.
 * Delega cache-aside a cacheService.
 */

// GET /api/products  (HU12)
const getProducts = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const cacheKey = `list:${page}:${limit}`;

        const result = await cacheService.getOrSet('products', cacheKey, async () => {
            const [rows, count] = await Promise.all([
                productRepository.findAll({ limit, offset }),
                productRepository.countAll(),
            ]);
            return {
                data: rows.rows,
                pagination: {
                    total: parseInt(count.rows[0].count, 10),
                    page,
                    limit,
                    totalPages: Math.ceil(count.rows[0].count / limit),
                },
            };
        });

        res.status(200).json(result);
    } catch (error) {
        logger.error('Error al obtener productos', { error: error.message });
        next(error);
    }
};

// GET /api/products/:id  (HU15)
const getProductById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const cacheKey = id;

        const data = await cacheService.getOrSet('products', cacheKey, async () => {
            const result = await productRepository.findById(id);
            return result.rows.length > 0 ? result.rows[0] : null;
        });

        if (!data) {
            return res.status(404).json({ error: 'Producto no encontrado.', code: 'NOT_FOUND' });
        }
        res.status(200).json(data);
    } catch (error) {
        logger.error('Error al obtener producto', { error: error.message });
        next(error);
    }
};

// POST /api/products  (HU10)
const createProduct = async (req, res, next) => {
    const { nom_prod, descrip_prod, precio_unitario, fechaven_prod, fk_cod_cats, stock_actual, stock_minimo } = req.body;
    const url_imagen = req.file ? req.file.path : null;

    let parsedCats = [];
    if (fk_cod_cats) {
        try {
            parsedCats = typeof fk_cod_cats === 'string' ? JSON.parse(fk_cod_cats) : fk_cod_cats;
            if (!Array.isArray(parsedCats)) parsedCats = [Number(parsedCats)];
            else parsedCats = parsedCats.map(Number);
        } catch (e) {
            parsedCats = Array.isArray(fk_cod_cats) ? fk_cod_cats.map(Number) : [Number(fk_cod_cats)];
        }
    }

    try {
        const result = await productRepository.create({
            nom_prod,
            descrip_prod: descrip_prod || null,
            precio_unitario: Number(precio_unitario),
            fechaven_prod: fechaven_prod || null,
            fk_cod_cats: parsedCats,
            stock_actual: Number(stock_actual || 0),
            stock_minimo: Number(stock_minimo || 0),
            url_imagen
        });
        logger.info('Producto creado', { cod_prod: result.rows[0].cod_prod });

        // Invalidar cache del listado
        await cacheService.invalidate('products');

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: `Una de las categorías proporcionadas no existe.`, code: 'FK_NOT_FOUND' });
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

        if (req.file && req.file.path) {
            fields.url_imagen = req.file.path;
        }

        if (fields.precio_unitario !== undefined) fields.precio_unitario = Number(fields.precio_unitario);
        if (fields.stock_actual !== undefined) fields.stock_actual = Number(fields.stock_actual);
        if (fields.stock_minimo !== undefined) fields.stock_minimo = Number(fields.stock_minimo);

        if (fields.fk_cod_cats) {
            try {
                fields.fk_cod_cats = typeof fields.fk_cod_cats === 'string' ? JSON.parse(fields.fk_cod_cats) : fields.fk_cod_cats;
                if (!Array.isArray(fields.fk_cod_cats)) fields.fk_cod_cats = [Number(fields.fk_cod_cats)];
                else fields.fk_cod_cats = fields.fk_cod_cats.map(Number);
            } catch (e) {
                fields.fk_cod_cats = Array.isArray(fields.fk_cod_cats) ? fields.fk_cod_cats.map(Number) : [Number(fields.fk_cod_cats)];
            }
        }

        const result = await productRepository.update(productId, fields);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado o ningún campo válido enviado.', code: 'NOT_FOUND' });
        }
        logger.info('Producto actualizado', { cod_prod: id });

        // Invalidar cache
        await cacheService.invalidate('products');

        res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: `Una de las categorías proporcionadas no existe.`, code: 'FK_NOT_FOUND' });
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
            return res.status(404).json({ error: 'Producto no encontrado.', code: 'NOT_FOUND' });
        }
        logger.info('Producto eliminado', { cod_prod: id });

        // Invalidar cache
        await cacheService.invalidate('products');

        res.status(200).json({ message: 'Producto eliminado exitosamente.' });
    } catch (error) {
        logger.error('Error al eliminar producto', { error: error.message });
        next(error);
    }
};

// PUT /api/products/:id/stock
const updateStock = async (req, res, next) => {
    const { id } = req.params;
    const { cantidad } = req.body;

    try {
        if (Number(cantidad) < 0) {
            const current = await productRepository.findById(id);
            if (current.rows.length === 0) {
                return res.status(404).json({ error: 'Producto no encontrado.', code: 'NOT_FOUND' });
            }
            const proyectado = current.rows[0].stock_actual + Number(cantidad);
            if (proyectado < 0) {
                return res.status(409).json({
                    error: 'Stock insuficiente.',
                    code: 'INSUFFICIENT_STOCK',
                    stock_actual: current.rows[0].stock_actual,
                    cantidad_solicitada: Number(cantidad),
                    mensaje: `⚠️ No se puede restar ${Math.abs(Number(cantidad))} unidades. Stock actual: ${current.rows[0].stock_actual}.`,
                });
            }
        }

        const result = await productRepository.updateStock(id, Number(cantidad));
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.', code: 'NOT_FOUND' });
        }

        const producto = result.rows[0];
        logger.info('Stock actualizado', { cod_prod: id, stock_actual: producto.stock_actual });

        // Invalidar cache
        await cacheService.invalidate('products');

        const alertaStockCritico = producto.stock_actual <= producto.stock_minimo;
        if (alertaStockCritico) {
            logger.warn('ALERTA: Stock crítico', {
                cod_prod: id, stock_actual: producto.stock_actual, stock_minimo: producto.stock_minimo,
            });

            // Enviar notificación en tiempo real vía Redis Stream (payload JSON estructurado)
            const redisClient = cacheService.getRedis();
            if (redisClient) {
                const payload = JSON.stringify({
                    to: process.env.ADMIN_EMAIL || 'admin@kiora.com',
                    subject: '⚠️ Alerta: Stock Crítico (Actualización Directa)',
                    event_type: 'CRITICAL_STOCK_UPDATE',
                    cod_prod: id,
                    nom_prod: producto.nom_prod,
                    stock_actual: producto.stock_actual,
                    stock_minimo: producto.stock_minimo
                });
                redisClient.xadd('kiora:notifications:stream', '*', 'payload', payload).catch(err => {
                    logger.error('Error al enviar alerta a Redis', { error: err.message });
                });
            }
        }

        res.status(200).json({
            ...producto,
            alerta_stock_critico: alertaStockCritico,
            mensaje: alertaStockCritico
                ? `⚠️ Stock actual (${producto.stock_actual}) es menor o igual al mínimo configurado (${producto.stock_minimo}).`
                : undefined,
        });
    } catch (error) {
        if (error.code === '23514' && error.constraint === 'chk_stock_actual_no_negativo') {
            return res.status(409).json({
                error: 'Stock insuficiente.',
                code: 'INSUFFICIENT_STOCK',
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
