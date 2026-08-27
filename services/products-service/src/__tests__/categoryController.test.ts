export {};
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import * as categoryController from '../controllers/categoryController';
import * as categoryRepository from '../repositories/categoryRepository';

// Mock repository
jest.mock('../repositories/categoryRepository');

const app = express();
app.use(express.json());
app.get('/api/categories', categoryController.getCategories);
app.get('/api/categories/:id', categoryController.getCategoryById);
app.post('/api/categories', categoryController.createCategory);
app.put('/api/categories/:id', categoryController.updateCategory);
app.delete('/api/categories/:id', categoryController.deleteCategory);

describe('Category Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/categories', () => {
        it('debe retornar lista de categorias', async () => {
            (categoryRepository.findAll as jest.Mock).mockResolvedValueOnce({ rows: [{ cod_cat: 1, nom_cat: 'Cat 1' }] });
            (categoryRepository.countAll as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
            const res = await request(app).get('/api/categories');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
    });

    describe('POST /api/categories', () => {
        it('debe crear una categoria', async () => {
            (categoryRepository.create as jest.Mock).mockResolvedValueOnce({ rows: [{ cod_cat: 1, nom_cat: 'New Cat' }] });

            const res = await request(app).post('/api/categories').send({
                nom_cat: 'New Cat'
            });

            expect(res.status).toBe(201);
            expect(res.body.nom_cat).toBe('New Cat');
        });
    });
});
