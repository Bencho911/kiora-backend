export {};
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import * as productController from '../controllers/productController';
import * as productRepository from '../repositories/productRepository';
import cacheService from '../services/cacheService';

// Mock repository and cache
jest.mock('../repositories/productRepository');
jest.mock('../services/cacheService', () => ({
    getOrSet: jest.fn((namespace, key, callback) => callback()),
    invalidate: jest.fn(),
    getRedis: jest.fn(() => ({ xadd: jest.fn().mockResolvedValue(true) }))
}));
jest.mock('../utils/logActivity', () => jest.fn());

const app = express();
app.use(express.json());
app.get('/api/products', productController.getProducts);
app.get('/api/products/low-stock', productController.getLowStock);
app.get('/api/products/:id', productController.getProductById);
app.post('/api/products', (req: Request, res: Response, next: NextFunction) => {
    (req as any).user = { correo_usu: 'test@admin.com' };
    next();
}, productController.createProduct);
app.put('/api/products/:id', (req: Request, res: Response, next: NextFunction) => {
    (req as any).user = { correo_usu: 'test@admin.com' };
    next();
}, productController.updateProduct);
app.delete('/api/products/:id', (req: Request, res: Response, next: NextFunction) => {
    (req as any).user = { correo_usu: 'test@admin.com' };
    next();
}, productController.deleteProduct);
app.put('/api/products/:id/stock', productController.updateStock);

describe('Product Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/products', () => {
        it('debe retornar lista de productos', async () => {
            (productRepository.findAll as jest.Mock).mockResolvedValueOnce({ rows: [{ cod_prod: 1, nom_prod: 'Product 1' }] });
            (productRepository.countAll as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });

            const res = await request(app).get('/api/products');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.pagination.total).toBe(1);
        });
    });

    describe('GET /api/products/:id', () => {
        it('debe retornar un producto por id', async () => {
            (productRepository.findById as jest.Mock).mockResolvedValueOnce({ rows: [{ cod_prod: 1, nom_prod: 'Product 1' }] });
            const res = await request(app).get('/api/products/1');
            expect(res.status).toBe(200);
            expect(res.body.nom_prod).toBe('Product 1');
        });

        it('debe retornar 404 si no existe', async () => {
            (productRepository.findById as jest.Mock).mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get('/api/products/999');
            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/products', () => {
        it('debe crear un producto', async () => {
            (productRepository.findByName as jest.Mock).mockResolvedValueOnce({ rows: [] });
            (productRepository.create as jest.Mock).mockResolvedValueOnce({ rows: [{ cod_prod: 1, nom_prod: 'New Product' }] });
            (productRepository.createProductTienda as jest.Mock).mockResolvedValueOnce({});

            const res = await request(app).post('/api/products').send({
                nom_prod: 'New Product',
                precio_unitario: 100,
            });

            expect(res.status).toBe(201);
            expect(res.body.nom_prod).toBe('New Product');
            expect(cacheService.invalidate).toHaveBeenCalledWith('products');
        });
    });

    describe('PUT /api/products/:id', () => {
        it('debe actualizar un producto', async () => {
            (productRepository.findById as jest.Mock).mockResolvedValueOnce({ rows: [{ cod_prod: 1, nom_prod: 'Old Product' }] });
            (productRepository.update as jest.Mock).mockResolvedValueOnce({ rows: [{ cod_prod: 1, nom_prod: 'Updated Product' }] });

            const res = await request(app).put('/api/products/1').send({
                nom_prod: 'Updated Product',
            });

            expect(res.status).toBe(200);
            expect(res.body.nom_prod).toBe('Updated Product');
        });
    });

    describe('DELETE /api/products/:id', () => {
        it('debe eliminar un producto', async () => {
            (productRepository.remove as jest.Mock).mockResolvedValueOnce({ rows: [{ cod_prod: 1, nom_prod: 'Deleted Product' }] });
            global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ hasSales: false }) })) as any;

            const res = await request(app).delete('/api/products/1');
            expect(res.status).toBe(200);
        });
    });

    describe('PUT /api/products/:id/stock', () => {
        it('debe actualizar el stock y no alertar si no es crítico', async () => {
            (productRepository.updateStock as jest.Mock).mockResolvedValueOnce({ rows: [{ cod_prod: 1, stock_actual: 50, stock_minimo: 10 }] });

            const res = await request(app).put('/api/products/1/stock').send({ cantidad: 10 });
            expect(res.status).toBe(200);
            expect(res.body.stock_actual).toBe(50);
            expect(res.body.alerta_stock_critico).toBe(false);
        });

        it('debe rechazar si la cantidad a restar supera el stock actual', async () => {
            (productRepository.findById as jest.Mock).mockResolvedValueOnce({ rows: [{ cod_prod: 1, stock_actual: 5 }] });
            const res = await request(app).put('/api/products/1/stock').send({ cantidad: -10 });
            expect(res.status).toBe(409);
            expect(res.body.code).toBe('INSUFFICIENT_STOCK');
        });
    });
});
