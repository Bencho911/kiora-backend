export {};
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import * as orderController from '../controllers/orderController';
import * as orderRepository from '../repositories/orderRepository';
import * as orderService from '../services/orderService';
import { logActivity } from '../utils/logActivity';

// Mock repository and service
jest.mock('../repositories/orderRepository');
jest.mock('../services/orderService');
jest.mock('../utils/logActivity', () => ({ logActivity: jest.fn() }));

const app = express();
app.use(express.json());
app.get('/api/orders', orderController.getOrders);
app.get('/api/orders/:id', orderController.getOrderById);
app.post('/api/orders', (req: Request, res: Response, next: NextFunction) => {
    (req as any).user = { correo_usu: 'test@admin.com', nombre_usu: 'Admin' };
    next();
}, orderController.createOrder);
app.put('/api/orders/:id/status', (req: Request, res: Response, next: NextFunction) => {
    (req as any).user = { correo_usu: 'test@admin.com', nombre_usu: 'Admin' };
    next();
}, orderController.updateOrderStatus);
app.delete('/api/orders/:id', orderController.deleteOrder);
app.get('/api/orders/products/:id/has-sales', orderController.checkProductSales);

describe('Order Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/orders', () => {
        it('debe retornar lista de ordenes', async () => {
            (orderRepository.findAll as jest.Mock).mockResolvedValueOnce({ rows: [{ id_vent: 1 }] });
            (orderRepository.countAll as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });

            const res = await request(app).get('/api/orders');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.pagination.total).toBe(1);
        });
    });

    describe('GET /api/orders/:id', () => {
        it('debe retornar una orden por id', async () => {
            (orderRepository.findByIdWithItems as jest.Mock).mockResolvedValueOnce({ id_vent: 1 });
            const res = await request(app).get('/api/orders/1');
            expect(res.status).toBe(200);
            expect(res.body.id_vent).toBe(1);
        });

        it('debe retornar 404 si no existe', async () => {
            (orderRepository.findByIdWithItems as jest.Mock).mockResolvedValueOnce(null);
            const res = await request(app).get('/api/orders/999');
            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/orders', () => {
        it('debe crear una orden y delegar a orderService', async () => {
            (orderService.createOrder as jest.Mock).mockResolvedValueOnce({ id_vent: 1, montofinal_vent: 100 });

            const res = await request(app).post('/api/orders').send({
                items: [{ cod_prod: 1, cantidad: 2 }],
                metodopago_usu: 'efectivo'
            });

            expect(res.status).toBe(201);
            expect(res.body.id_vent).toBe(1);
            expect(orderService.createOrder).toHaveBeenCalled();
        });
    });

    describe('PUT /api/orders/:id/status', () => {
        it('debe actualizar el estado de una orden', async () => {
            (orderService.updateStatus as jest.Mock).mockResolvedValueOnce({ data: { id_vent: 1, estado: 'completada' } });

            const res = await request(app).put('/api/orders/1/status').send({
                estado: 'completada'
            });

            expect(res.status).toBe(200);
            expect(res.body.estado).toBe('completada');
            expect(orderService.updateStatus).toHaveBeenCalledWith('1', 'completada', expect.any(Object));
        });

        it('debe retornar error si falla el servicio', async () => {
            (orderService.updateStatus as jest.Mock).mockResolvedValueOnce({ error: 'Stock insuficiente', status: 409 });

            const res = await request(app).put('/api/orders/1/status').send({
                estado: 'completada'
            });

            expect(res.status).toBe(409);
            expect(res.body.error).toBe('Stock insuficiente');
        });
    });

    describe('DELETE /api/orders/:id', () => {
        it('debe eliminar una orden', async () => {
            (orderRepository.remove as jest.Mock).mockResolvedValueOnce({ rows: [{ id_vent: 1 }] });

            const res = await request(app).delete('/api/orders/1');
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/orders/products/:id/has-sales', () => {
        it('debe chequear si un producto tiene ventas', async () => {
            (orderRepository.checkProductInSales as jest.Mock).mockResolvedValueOnce(true);

            const res = await request(app).get('/api/orders/products/1/has-sales');
            expect(res.status).toBe(200);
            expect(res.body.hasSales).toBe(true);
        });
    });
});
