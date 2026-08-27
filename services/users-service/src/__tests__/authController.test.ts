export {};
import request from 'supertest';
import app from '../app';
import pool from '../config/db';
import * as blacklist from '../config/blacklist';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

jest.mock('../config/db', () => {
    return {
        query: jest.fn(),
        connect: jest.fn(),
    };
});

jest.mock('../config/blacklist', () => ({
    add: jest.fn(),
    has: jest.fn(),
    ping: jest.fn(),
}));

describe('Auth API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test_secret';
    });

    describe('POST /api/auth/login', () => {
        it('debe retornar 400 si faltan campos', async () => {
            const res = await request(app).post('/api/auth/login').send({ correo_usu: 'test@test.com' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });

        it('debe retornar 401 genérico si el usuario no existe (seguridad)', async () => {
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

            const res = await request(app).post('/api/auth/login').send({
                correo_usu: 'test@test.com',
                password: 'password123',
            });
            if (res.status === 400) console.log(res.body);
            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/Credenciales incorrectas/);
        });

        it('debe retornar 401 si la contraseña es incorrecta con conteo de intentos', async () => {
            (pool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ id_usu: 1, correo_usu: 'test@test.com', password_usu: 'hashed_password', estado_usu: 'activo' }],
            });

            jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

            const res = await request(app).post('/api/auth/login').send({
                correo_usu: 'test@test.com',
                password: 'wrongpassword',
            });
            
            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/Credenciales incorrectas/);
        });

        it('debe retornar tokens en caso de éxito', async () => {
            (pool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ id_usu: 1, correo_usu: 'test@test.com', password_usu: 'hashed_password', estado_usu: 'activo', rol_usu: 'admin' }],
            });
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // Update last login

            jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

            const res = await request(app).post('/api/auth/login').send({
                correo_usu: 'test@test.com',
                password: 'password123',
            });
            
            expect(res.status).toBe(200);
            expect(res.body.usuario).toHaveProperty('id_usu', 1);
            expect(res.body).toHaveProperty('token');
        });
        
        it('debe bloquear usuario tras múltiples intentos fallidos', async () => {
            (pool.query as jest.Mock)
                .mockResolvedValueOnce({
                    rows: [{ id_usu: 1, correo_usu: 'test@test.com', password_usu: 'hashed_password', estado_usu: 'activo', intentos_fallidos: 4 }],
                }) // SELECT user
                .mockResolvedValueOnce({ rows: [] }); // UPDATE attempts

            jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

            const res = await request(app).post('/api/auth/login').send({
                correo_usu: 'test@test.com',
                password: 'wrongpassword',
            });
            
            expect(res.status).toBe(423);
            expect(res.body.error).toMatch(/bloqueada/);
            // Verifica que la query de update bloqueado_hasta se llamó
            expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("bloqueado_hasta"), [5, 1]);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('debe añadir el token a la lista negra', async () => {
            const token = jwt.sign({ id_usu: 1, sv: 0 }, 'test_secret');
            (blacklist.has as jest.Mock).mockResolvedValue(false);
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ session_version: 0 }] });

            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(blacklist.add).toHaveBeenCalledWith(token);
        });
    });
});
