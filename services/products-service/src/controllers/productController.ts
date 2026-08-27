'use strict';

import * as productRepository from '../repositories/productRepository';
import cacheService from '../services/cacheService';
import parsePagination from '../utils/parsePagination';
import logActivity from '../utils/logActivity';
import logger from '../config/logger';
import { Request, Response, NextFunction } from 'express';

// Definir tipo custom Request para User
interface CustomRequest extends Request {
    user?: any;
}

/**
 * productController
 * Orquesta request → cache/repository → response.
 * Delega cache-aside a cacheService.
 */

// GET /api/products  (HU12)
export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const storeId = req.query.store_id ? Number(req.query.store_id) : null;

        if (storeId) {
            const cacheKey = `store:${storeId}:${page}:${limit}`;
            const result = await cacheService.getOrSet('products', cacheKey, async () => {
                const [rows, count] = await Promise.all([
                    productRepository.findAllByStore({ storeId, limit, offset }),
                    productRepository.countAllByStore(storeId),
                ]);
                return {
                    data: rows.rows,
                    pagination: {
                        total: parseInt(count.rows[0].count, 10),
                        page,
                        limit,
                        totalPages: Math.ceil(count.rows[0].count / limit),
                    },
                    store_id: storeId,
                };
            });
            res.status(200).json(result);
            return;
        }

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
    } catch (error: unknown) {
        logger.error('Error al obtener productos', { error: (error as Error).message });
        next(error);
    }
};

// GET /api/products/:id  (HU15)
export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const storeId = req.query.store_id ? Number(req.query.store_id) : null;
    try {
        if (storeId) {
            const cacheKey = `store:${storeId}:${id}`;
            const data = await cacheService.getOrSet('products', cacheKey, async () => {
                const result = await productRepository.findByIdAndStore(Number(id), storeId);
                return result.rows.length > 0 ? result.rows[0] : null;
            });
            if (!data) {
                res.status(404).json({ error: 'Producto no disponible en esta tienda.', code: 'NOT_FOUND' });
                return;
            }
            res.status(200).json(data);
            return;
        }

        const cacheKey = String(id);
        const data = await cacheService.getOrSet('products', cacheKey, async () => {
            const result = await productRepository.findById(Number(id));
            return result.rows.length > 0 ? result.rows[0] : null;
        });

        if (!data) {
            res.status(404).json({ error: 'Producto no encontrado.', code: 'NOT_FOUND' });
            return;
        }
        res.status(200).json(data);
    } catch (error: unknown) {
        logger.error('Error al obtener producto', { error: (error as Error).message });
        next(error);
    }
};

// POST /api/products  (HU10)
export const createProduct = async (req: CustomRequest, res: Response, next: NextFunction) => {
    const { nom_prod, descrip_prod, precio_unitario, descuento, fechaven_prod, fk_cod_cats, stock_actual, stock_minimo, codigo_barras } = req.body;
    const url_imagen = req.file
        ? (req.file.path?.startsWith('http')
            ? req.file.path
            : `/uploads/${req.file.filename}`)
        : null;

    let parsedCats: number[] = [];
    if (fk_cod_cats) {
        try {
            const pc = typeof fk_cod_cats === 'string' ? JSON.parse(fk_cod_cats) : fk_cod_cats;
            if (!Array.isArray(pc)) parsedCats = [Number(pc)];
            else parsedCats = pc.map(Number);
        } catch (e) {
            parsedCats = Array.isArray(fk_cod_cats) ? fk_cod_cats.map(Number) : [Number(fk_cod_cats)];
        }
    }

    try {
        const existing = await productRepository.findByName(nom_prod);
        if (existing.rows.length > 0) {
            res.status(409).json({ error: 'Ya existe un producto con ese nombre.', code: 'DUPLICATE_PRODUCT' });
            return;
        }

        if (codigo_barras) {
            const existingBarcode = await productRepository.findByBarcode(codigo_barras);
            if (existingBarcode.rows.length > 0) {
                res.status(409).json({ error: 'El código de barras ya está registrado.', code: 'DUPLICATE_BARCODE' });
                return;
            }
        }

        const result = await productRepository.create({
            nom_prod,
            descrip_prod: descrip_prod || null,
            precio_unitario: Number(precio_unitario),
            descuento: descuento !== undefined ? Number(descuento) : 0,
            fechaven_prod: fechaven_prod || null,
            fk_cod_cats: parsedCats,
            stock_actual: Number(stock_actual || 0),
            stock_minimo: Number(stock_minimo || 0),
            url_imagen,
            codigo_barras: codigo_barras || null
        });
        const newProduct = result.rows[0];
        logger.info('Producto creado', { cod_prod: newProduct.cod_prod });

        await productRepository.createProductTienda({
            cod_prod: newProduct.cod_prod,
            storeId: 1,
            precio_venta: Number(precio_unitario),
            stock_actual: Number(stock_actual || 0),
        }).catch(err => logger.warn('No se pudo registrar en Producto_Tienda', { error: err.message }));

        await cacheService.invalidate('products');

        res.status(201).json(newProduct);

        logActivity({ user_email: req.user?.correo_usu, action: 'created', entity_type: 'product', entity_id: newProduct?.cod_prod, details: `Producto "${newProduct?.nom_prod}" creado` });
    } catch (error: unknown) {
        if ((error as any).code === '23503') {
            res.status(400).json({ error: `Una de las categorías proporcionadas no existe.`, code: 'FK_NOT_FOUND' });
            return;
        }
        logger.error('Error al crear producto', { error: (error as Error).message });
        next(error);
    }
};

// PUT /api/products/:id  (HU11)
export const updateProduct = async (req: CustomRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const productId = Number(id);

    try {
        const fields = { ...req.body };

        if (req.file) {
            fields.url_imagen = req.file.path?.startsWith('http')
                ? req.file.path
                : `/uploads/${req.file.filename}`;
        }

        if (fields.precio_unitario !== undefined) fields.precio_unitario = Number(fields.precio_unitario);
        if (fields.stock_actual !== undefined) fields.stock_actual = Number(fields.stock_actual);
        if (fields.stock_minimo !== undefined) fields.stock_minimo = Number(fields.stock_minimo);

        if (fields.fk_cod_cats) {
            try {
                const fc = typeof fields.fk_cod_cats === 'string' ? JSON.parse(fields.fk_cod_cats) : fields.fk_cod_cats;
                if (!Array.isArray(fc)) fields.fk_cod_cats = [Number(fc)];
                else fields.fk_cod_cats = fc.map(Number);
            } catch (e) {
                fields.fk_cod_cats = Array.isArray(fields.fk_cod_cats) ? fields.fk_cod_cats.map(Number) : [Number(fields.fk_cod_cats)];
            }
        }
        
        const existingResult = await productRepository.findById(productId);
        if (existingResult.rows.length === 0) {
            res.status(404).json({ error: 'Producto no encontrado.', code: 'NOT_FOUND' });
            return;
        }
        const existing = existingResult.rows[0];

        if (fields.codigo_barras) {
            const existingBarcode = await productRepository.findByBarcode(fields.codigo_barras);
            if (existingBarcode.rows.length > 0 && existingBarcode.rows[0].cod_prod !== productId) {
                res.status(409).json({ error: 'El código de barras ya está registrado por otro producto.', code: 'DUPLICATE_BARCODE' });
                return;
            }
        }

        let hasChanges = false;
        for (const key of Object.keys(fields)) {
            if (key === 'fk_cod_cats') {
                const arr1 = [...fields[key]].sort();
                const arr2 = [...(existing[key] || [])].sort();
                if (JSON.stringify(arr1) !== JSON.stringify(arr2)) { hasChanges = true; break; }
            } else if (key === 'fechaven_prod' && fields[key]) {
                const d1 = new Date(fields[key]).toISOString().split('T')[0];
                const d2 = existing[key] ? new Date(existing[key]).toISOString().split('T')[0] : null;
                if (d1 !== d2) { hasChanges = true; break; }
            } else if (Number.isNaN(Number(fields[key])) && Number.isNaN(Number(existing[key]))) {
                if (String(fields[key]) !== String(existing[key])) { hasChanges = true; break; }
            } else if (fields[key] !== existing[key]) {
                if (fields[key] == existing[key]) continue;
                hasChanges = true;
                break;
            }
        }

        if (!hasChanges) {
            res.status(200).json({ message: 'No se detectaron cambios', ...existing });
            return;
        }

        const result = await productRepository.update(productId, fields);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Producto no encontrado o ningún campo válido enviado.', code: 'NOT_FOUND' });
            return;
        }
        logger.info('Producto actualizado', { cod_prod: id });

        await cacheService.invalidate('products');

        res.status(200).json(result.rows[0]);

        logActivity({ user_email: req.user?.correo_usu, action: 'updated', entity_type: 'product', entity_id: String(id), details: `Producto "${result.rows[0]?.nom_prod}" actualizado` });
    } catch (error: unknown) {
        if ((error as any).code === '23503') {
            res.status(400).json({ error: `Una de las categorías proporcionadas no existe.`, code: 'FK_NOT_FOUND' });
            return;
        }
        logger.error('Error al actualizar producto', { error: (error as Error).message });
        next(error);
    }
};

// DELETE /api/products/:id  (HU13)
export const deleteProduct = async (req: CustomRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        const ordersUrl = process.env.ORDERS_SERVICE_URL || 'http://orders-service:3004';
        try {
            const checkRes = await fetch(`${ordersUrl}/api/orders/products/${id}/has-sales`);
            if (checkRes.ok) {
                const data = await checkRes.json() as any;
                if (data.hasSales) {
                    res.status(409).json({
                        error: 'No se puede eliminar el producto porque está vinculado a una o más ventas históricas.',
                        code: 'HAS_SALES_HISTORY'
                    });
                    return;
                }
            }
        } catch (fetchErr: unknown) {
            logger.warn('No se pudo contactar a orders-service para verificar ventas', { error: (fetchErr as Error).message });
        }
        const result = await productRepository.remove(Number(id));
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Producto no encontrado.', code: 'NOT_FOUND' });
            return;
        }
        logger.info('Producto eliminado', { cod_prod: id });

        await cacheService.invalidate('products');

        res.status(200).json({ message: 'Producto eliminado exitosamente.' });

        logActivity({ user_email: req.user?.correo_usu, action: 'deleted', entity_type: 'product', entity_id: String(id), details: `Producto "${result.rows[0]?.nom_prod}" eliminado` });
    } catch (error: unknown) {
        logger.error('Error al eliminar producto', { error: (error as Error).message });
        next(error);
    }
};

// PUT /api/products/:id/stock
export const updateStock = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { cantidad } = req.body;

    try {
        if (Number(cantidad) < 0) {
            const current = await productRepository.findById(Number(id));
            if (current.rows.length === 0) {
                res.status(404).json({ error: 'Producto no encontrado.', code: 'NOT_FOUND' });
                return;
            }
            const proyectado = current.rows[0].stock_actual + Number(cantidad);
            if (proyectado < 0) {
                res.status(409).json({
                    error: 'Stock insuficiente.',
                    code: 'INSUFFICIENT_STOCK',
                    stock_actual: current.rows[0].stock_actual,
                    cantidad_solicitada: Number(cantidad),
                    mensaje: `⚠️ No se puede restar ${Math.abs(Number(cantidad))} unidades. Stock actual: ${current.rows[0].stock_actual}.`,
                });
                return;
            }
        }

        const result = await productRepository.updateStock(Number(id), Number(cantidad));
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Producto no encontrado.', code: 'NOT_FOUND' });
            return;
        }

        const producto = result.rows[0];
        logger.info('Stock actualizado', { cod_prod: id, stock_actual: producto.stock_actual });

        await cacheService.invalidate('products');

        const alertaStockCritico = producto.stock_actual <= producto.stock_minimo;
        if (alertaStockCritico) {
            logger.warn('ALERTA: Stock crítico', {
                cod_prod: id, stock_actual: producto.stock_actual, stock_minimo: producto.stock_minimo,
            });

            const redisClient = cacheService.getRedis();
            if (redisClient) {
                const adminEmails = process.env.ADMIN_EMAIL || 'admin@kiora.com';
                const payload = JSON.stringify({
                    to: adminEmails,
                    subject: '⚠️ Alerta: Stock Crítico (Actualización Directa)',
                    html: `<div style="font-family:sans-serif;padding:20px;">
                        <h2 style="color:#C41E1E;">⚠️ Stock Crítico Detectado</h2>
                        <p>Producto: <strong>${producto.nom_prod || 'ID #' + id}</strong></p>
                        <p>Stock Actual: <strong style="color:#C41E1E;">${producto.stock_actual}</strong></p>
                        <p>Stock Mínimo: <strong>${producto.stock_minimo}</strong></p>
                        <hr><p style="color:#888;">Actualización directa desde products-service</p>
                    </div>`,
                });
                redisClient.xadd('kiora:notifications:stream', '*', 'payload', payload).catch(err => {
                    logger.error('err', { error: (err as Error).message });
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
    } catch (error: unknown) {
        if ((error as any).code === '23514' && (error as any).constraint === 'chk_stock_actual_no_negativo') {
            res.status(409).json({
                error: 'Stock insuficiente.',
                code: 'INSUFFICIENT_STOCK',
                mensaje: 'La operación dejaría el stock en negativo.',
            });
            return;
        }
        logger.error('Error al actualizar stock', { error: (error as Error).message });
        next(error);
    }
};

// GET /api/products/low-stock
export const getLowStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await productRepository.findLowStock();
        res.status(200).json({ data: result.rows });
    } catch (error: unknown) {
        logger.error('Error al obtener productos con bajo stock', { error: (error as Error).message });
        next(error);
    }
};
