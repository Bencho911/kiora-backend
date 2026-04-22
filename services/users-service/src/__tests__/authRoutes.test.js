const request = require('supertest');
const bcrypt = require('bcrypt');

// ─── Mock de la base de datos ANTES de importar la app ───────────────────────
jest.mock('../config/db', () => ({
    query: jest.fn(),
    connect: jest.fn(),
}));

// ─── Mock de emailService para evitar llamadas reales a SMTP ───────────────
jest.mock('../config/emailService', () => ({
    sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    buildResetCodeHtml: jest.fn().mockReturnValue('<p>mock html</p>'),
    RESET_CODE_EXPIRY_MINUTES: 15,
}));

// ─── Variables de entorno para tests ────────────────────────────────────────
process.env.JWT_SECRET = 'test_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.NODE_ENV = 'test';

const db = require('../config/db');
const blacklist = require('../config/blacklist');
const app = require('../app'); // ← importamos la app completa (con helmet y errorHandler)

// ─── Helper: crear un hash de contraseña ────────────────────────────────────
const hashPassword = async (pass) => bcrypt.hash(pass, 10);

/** Primera query en rutas con verifyToken: comprobación de session_version */
const mockSessionVersionOnce = (sv = 0) => {
    db.query.mockResolvedValueOnce({ rows: [{ session_version: sv }] });
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {

    beforeEach(() => jest.clearAllMocks());

    test('400 – faltan campos obligatorios', async () => {
        const res = await request(app).post('/api/auth/login').send({});
        expect(res.statusCode).toBe(400);
    });

    test('401 – usuario no encontrado', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ correo_usu: 'noexiste@test.com', password: '1234' });

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/credenciales incorrectas/i);
    });

    test('423 – cuenta bloqueada', async () => {
        const bloqueado_hasta = new Date(Date.now() + 10 * 60000);
        db.query.mockResolvedValueOnce({
            rows: [{ id_usu: 1, password_usu: 'hash', bloqueado_hasta, intentos_fallidos: 5 }]
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ correo_usu: 'bloqueado@test.com', password: '1234' });

        expect(res.statusCode).toBe(423);
        expect(res.body.error).toMatch(/bloqueada/i);
    });

    test('401 – contraseña incorrecta (incrementa intentos)', async () => {
        const hash = await hashPassword('correcta');
        db.query
            .mockResolvedValueOnce({ rows: [{ id_usu: 1, password_usu: hash, bloqueado_hasta: null, intentos_fallidos: 0 }] })
            .mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ correo_usu: 'user@test.com', password: 'incorrecta' });

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/intento 1 de 5/i);
    });

    test('423 – bloqueo al llegar a 5 intentos fallidos', async () => {
        const hash = await hashPassword('correcta');
        db.query
            .mockResolvedValueOnce({ rows: [{ id_usu: 1, password_usu: hash, bloqueado_hasta: null, intentos_fallidos: 4 }] })
            .mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ correo_usu: 'user@test.com', password: 'incorrecta' });

        expect(res.statusCode).toBe(423);
        expect(res.body.error).toMatch(/bloqueada por demasiados intentos/i);
    });

    test('200 – login exitoso (móvil): devuelve token en body', async () => {
        const hash = await hashPassword('mipassword');
        db.query
            .mockResolvedValueOnce({ rows: [{ id_usu: 1, nom_usu: 'Ruben', correo_usu: 'r@test.com', rol_usu: 'cliente', password_usu: hash, bloqueado_hasta: null, intentos_fallidos: 0 }] })
            .mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ correo_usu: 'r@test.com', password: 'mipassword' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.usuario).toHaveProperty('id_usu', 1);
    });

    test('200 – login exitoso (web): devuelve cookie HttpOnly', async () => {
        const hash = await hashPassword('mipassword');
        db.query
            .mockResolvedValueOnce({ rows: [{ id_usu: 1, nom_usu: 'Ruben', correo_usu: 'r@test.com', rol_usu: 'cliente', password_usu: hash, bloqueado_hasta: null, intentos_fallidos: 0 }] })
            .mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/login')
            .set('x-client-type', 'web')
            .send({ correo_usu: 'r@test.com', password: 'mipassword' });

        expect(res.statusCode).toBe(200);
        expect(res.body).not.toHaveProperty('token');
        expect(res.headers['set-cookie']).toBeDefined();
    });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/register', () => {
    let adminToken;

    beforeAll(async () => {
        const jwt = require('jsonwebtoken');
        adminToken = jwt.sign(
            { id_usu: 99, correo_usu: 'admin@test.com', rol_usu: 'admin', sv: 0 },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );
    });

    beforeEach(() => jest.clearAllMocks());

    test('401 – sin token', async () => {
        const res = await request(app).post('/api/auth/register').send({ nom_usu: 'Test', correo_usu: 'a@a.com', password: 'Aa1!aaaa' });
        expect(res.statusCode).toBe(401);
    });

    test('400 – faltan campos obligatorios', async () => {
        mockSessionVersionOnce(0);
        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ correo_usu: 'a@a.com' });

        expect(res.statusCode).toBe(400);
    });

    test('409 – correo ya registrado', async () => {
        mockSessionVersionOnce(0);
        db.query.mockResolvedValueOnce({ rows: [{ id_usu: 5 }] });

        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ nom_usu: 'Test', correo_usu: 'existe@test.com', password: 'Aa1!aaaa' });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toMatch(/ya está registrado/i);
    });

    test('201 – registro exitoso', async () => {
        mockSessionVersionOnce(0);
        db.query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id_usu: 10 }] });

        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ nom_usu: 'Nuevo', correo_usu: 'nuevo@test.com', password: 'Aa1!aaaa' });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('id_usu', 10);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/auth/logout
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/logout', () => {

    beforeEach(async () => {
        jest.clearAllMocks();
        await blacklist.resetForTests();
    });

    test('401 – sin token', async () => {
        const res = await request(app).post('/api/auth/logout');
        expect(res.statusCode).toBe(401);
    });

    test('200 – logout exitoso', async () => {
        const jwt = require('jsonwebtoken');
        mockSessionVersionOnce(0);
        const token = jwt.sign({ id_usu: 1, correo_usu: 'r@test.com', rol_usu: 'cliente', sv: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/cerrada exitosamente/i);
    });

    test('200 – logout revoca también el refresh token', async () => {
        const jwt = require('jsonwebtoken');
        mockSessionVersionOnce(0);
        const accessToken = jwt.sign(
            { id_usu: 1, correo_usu: 'r@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );
        const refreshToken = jwt.sign(
            { id_usu: 1, correo_usu: 'r@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        const logoutRes = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`)
            .set('Cookie', `kiora_refresh_token=${refreshToken}`);

        expect(logoutRes.statusCode).toBe(200);

        const refreshRes = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', `kiora_refresh_token=${refreshToken}`);

        expect(refreshRes.statusCode).toBe(401);
        expect(refreshRes.body.error).toMatch(/revocado/i);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/auth/users (solo admin)
// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/auth/users', () => {

    beforeEach(() => jest.clearAllMocks());

    test('401 – sin token', async () => {
        const res = await request(app).get('/api/auth/users');
        expect(res.statusCode).toBe(401);
    });

    test('403 – token de cliente (no admin)', async () => {
        const jwt = require('jsonwebtoken');
        mockSessionVersionOnce(0);
        const clienteToken = jwt.sign({ id_usu: 2, rol_usu: 'cliente', sv: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });

        const res = await request(app)
            .get('/api/auth/users')
            .set('Authorization', `Bearer ${clienteToken}`);

        expect(res.statusCode).toBe(403);
    });

    test('200 – admin obtiene lista de usuarios', async () => {
        const jwt = require('jsonwebtoken');
        mockSessionVersionOnce(0);
        const adminToken = jwt.sign({ id_usu: 99, rol_usu: 'admin', sv: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });

        db.query
            .mockResolvedValueOnce({ rows: [{ id_usu: 1, nom_usu: 'Ruben', correo_usu: 'r@test.com' }] })
            .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // countAll

        const res = await request(app)
            .get('/api/auth/users')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.pagination).toHaveProperty('total');
    });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/auth/refresh
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/refresh', () => {

    beforeEach(async () => {
        jest.clearAllMocks();
        await blacklist.resetForTests();
    });

    test('401 – sin cookie de refresh token', async () => {
        const res = await request(app).post('/api/auth/refresh');
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/no se proporcionó un refresh token/i);
    });

    test('403 – refresh token inválido / firmado con secret incorrecto', async () => {
        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', 'kiora_refresh_token=token.invalido.xxx');

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toMatch(/no válido o expirado/i);
    });

    test('401 – usuario no existe en la BD', async () => {
        const jwt = require('jsonwebtoken');
        const refreshToken = jwt.sign(
            { id_usu: 999, correo_usu: 'ghost@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        db.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', `kiora_refresh_token=${refreshToken}`);

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/usuario no válido/i);
    });

    test('423 – cuenta bloqueada al hacer refresh', async () => {
        const jwt = require('jsonwebtoken');
        const refreshToken = jwt.sign(
            { id_usu: 1, correo_usu: 'r@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        const bloqueado_hasta = new Date(Date.now() + 10 * 60000);
        db.query.mockResolvedValueOnce({
            rows: [{ id_usu: 1, nom_usu: 'Ruben', correo_usu: 'r@test.com', rol_usu: 'cliente', bloqueado_hasta, session_version: 0 }]
        });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', `kiora_refresh_token=${refreshToken}`);

        expect(res.statusCode).toBe(423);
        expect(res.body.error).toMatch(/bloqueada/i);
    });

    test('200 – refresh exitoso: devuelve nuevo access token y rota cookie', async () => {
        const jwt = require('jsonwebtoken');
        const refreshToken = jwt.sign(
            { id_usu: 1, correo_usu: 'r@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        db.query.mockResolvedValueOnce({
            rows: [{ id_usu: 1, nom_usu: 'Ruben', correo_usu: 'r@test.com', rol_usu: 'cliente', bloqueado_hasta: null, session_version: 0 }]
        });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', `kiora_refresh_token=${refreshToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        // El nuevo refresh token debe enviarse como cookie
        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies.some(c => c.startsWith('kiora_refresh_token='))).toBe(true);
    });

    test('401 – refresh token ya revocado', async () => {
        const jwt = require('jsonwebtoken');
        const refreshToken = jwt.sign(
            { id_usu: 1, correo_usu: 'r@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        db.query.mockResolvedValueOnce({
            rows: [{ id_usu: 1, nom_usu: 'Ruben', correo_usu: 'r@test.com', rol_usu: 'cliente', bloqueado_hasta: null, session_version: 0 }]
        });

        const firstRes = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', `kiora_refresh_token=${refreshToken}`);

        expect(firstRes.statusCode).toBe(200);

        const secondRes = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', `kiora_refresh_token=${refreshToken}`);

        expect(secondRes.statusCode).toBe(401);
        expect(secondRes.body.error).toMatch(/revocado/i);
    });

    test('401 – refresh con session_version obsoleta (p. ej. tras restablecer contraseña)', async () => {
        const jwt = require('jsonwebtoken');
        const refreshToken = jwt.sign(
            { id_usu: 1, correo_usu: 'r@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        db.query.mockResolvedValueOnce({
            rows: [{ id_usu: 1, nom_usu: 'Ruben', correo_usu: 'r@test.com', rol_usu: 'cliente', bloqueado_hasta: null, session_version: 1 }]
        });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', `kiora_refresh_token=${refreshToken}`);

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/ya no es válida|inicia sesión/i);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/auth/me
// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/auth/me', () => {

    beforeEach(() => jest.resetAllMocks());

    test('401 – sin token', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.statusCode).toBe(401);
    });

    test('401 – usuario del token inactivo o inexistente (sesión inválida)', async () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id_usu: 999, correo_usu: 'ghost@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        db.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/no válido|inicia sesión/i);
    });

    test('200 – devuelve perfil del usuario autenticado', async () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id_usu: 3, correo_usu: 'perfil@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        mockSessionVersionOnce(0);
        db.query.mockResolvedValueOnce({
            rows: [{ id_usu: 3, nom_usu: 'Ruben', correo_usu: 'perfil@test.com', rol_usu: 'cliente', tel_usu: null }]
        });

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('id_usu', 3);
        expect(res.body).toHaveProperty('nom_usu', 'Ruben');
        expect(res.body).not.toHaveProperty('password_usu');
    });

    test('200 – acceso por cookie (cliente web)', async () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id_usu: 2, correo_usu: 'web@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        mockSessionVersionOnce(0);
        db.query.mockResolvedValueOnce({
            rows: [{ id_usu: 2, nom_usu: 'WebUser', correo_usu: 'web@test.com', rol_usu: 'cliente', tel_usu: null }]
        });

        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', `token=${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('id_usu', 2);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/auth/users/:id  — HU43
// ════════════════════════════════════════════════════════════════════════════
describe('PATCH /api/auth/users/:id', () => {
    let adminToken;

    beforeAll(() => {
        const jwt = require('jsonwebtoken');
        adminToken = jwt.sign(
            { id_usu: 99, correo_usu: 'admin@test.com', rol_usu: 'admin', sv: 0 },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );
    });

    beforeEach(() => jest.clearAllMocks());

    test('401 – sin token', async () => {
        const res = await request(app).patch('/api/auth/users/1').send({ nom_usu: 'Nuevo' });
        expect(res.statusCode).toBe(401);
    });

    test('403 – token de cliente (no admin)', async () => {
        const jwt = require('jsonwebtoken');
        mockSessionVersionOnce(0);
        const clienteToken = jwt.sign({ id_usu: 2, rol_usu: 'cliente', sv: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });

        const res = await request(app)
            .patch('/api/auth/users/1')
            .set('Authorization', `Bearer ${clienteToken}`)
            .send({ nom_usu: 'Nuevo' });

        expect(res.statusCode).toBe(403);
    });

    test('400 – body vacío (sin campos para actualizar)', async () => {
        mockSessionVersionOnce(0);
        const res = await request(app)
            .patch('/api/auth/users/1')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});

        expect(res.statusCode).toBe(400);
    });

    test('404 – usuario no encontrado', async () => {
        mockSessionVersionOnce(0);
        db.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .patch('/api/auth/users/999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ nom_usu: 'Nuevo' });

        expect(res.statusCode).toBe(404);
        expect(res.body.error).toMatch(/no encontrado/i);
    });

    test('200 – actualización exitosa', async () => {
        mockSessionVersionOnce(0);
        db.query.mockResolvedValueOnce({
            rows: [{ id_usu: 1, nom_usu: 'Nuevo Nombre', correo_usu: 'r@test.com', rol_usu: 'cliente', tel_usu: null }]
        });

        const res = await request(app)
            .patch('/api/auth/users/1')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ nom_usu: 'Nuevo Nombre' });

        expect(res.statusCode).toBe(200);
        expect(res.body.usuario).toHaveProperty('nom_usu', 'Nuevo Nombre');
    });
});

// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/auth/users/:id  — HU44
// ════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/auth/users/:id', () => {
    let adminToken;

    beforeAll(() => {
        const jwt = require('jsonwebtoken');
        // id_usu: 99 para probar el guard de auto-eliminación
        adminToken = jwt.sign(
            { id_usu: 99, correo_usu: 'admin@test.com', rol_usu: 'admin', sv: 0 },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );
    });

    beforeEach(() => jest.clearAllMocks());

    test('401 – sin token', async () => {
        const res = await request(app).delete('/api/auth/users/1');
        expect(res.statusCode).toBe(401);
    });

    test('403 – token de cliente (no admin)', async () => {
        const jwt = require('jsonwebtoken');
        mockSessionVersionOnce(0);
        const clienteToken = jwt.sign({ id_usu: 2, rol_usu: 'cliente', sv: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });

        const res = await request(app)
            .delete('/api/auth/users/1')
            .set('Authorization', `Bearer ${clienteToken}`);

        expect(res.statusCode).toBe(403);
    });

    test('403 – admin intenta eliminarse a sí mismo', async () => {
        mockSessionVersionOnce(0);
        const res = await request(app)
            .delete('/api/auth/users/99')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toMatch(/tu propio usuario/i);
    });

    test('404 – usuario no encontrado', async () => {
        mockSessionVersionOnce(0);
        db.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .delete('/api/auth/users/999')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(404);
        expect(res.body.error).toMatch(/no encontrado/i);
    });

    test('200 – soft delete exitoso', async () => {
        mockSessionVersionOnce(0);
        db.query.mockResolvedValueOnce({ rows: [{ id_usu: 1 }] });

        const res = await request(app)
            .delete('/api/auth/users/1')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/eliminado exitosamente/i);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/auth/users/:id/role  — HU45
// ════════════════════════════════════════════════════════════════════════════
describe('PATCH /api/auth/users/:id/role', () => {
    let adminToken;

    beforeAll(() => {
        const jwt = require('jsonwebtoken');
        adminToken = jwt.sign(
            { id_usu: 99, correo_usu: 'admin@test.com', rol_usu: 'admin', sv: 0 },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );
    });

    beforeEach(() => jest.clearAllMocks());

    test('401 – sin token', async () => {
        const res = await request(app).patch('/api/auth/users/1/role').send({ rol_usu: 'admin' });
        expect(res.statusCode).toBe(401);
    });

    test('403 – token de cliente (no admin)', async () => {
        const jwt = require('jsonwebtoken');
        mockSessionVersionOnce(0);
        const clienteToken = jwt.sign({ id_usu: 2, rol_usu: 'cliente', sv: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });

        const res = await request(app)
            .patch('/api/auth/users/1/role')
            .set('Authorization', `Bearer ${clienteToken}`)
            .send({ rol_usu: 'admin' });

        expect(res.statusCode).toBe(403);
    });

    test('400 – rol inválido', async () => {
        mockSessionVersionOnce(0);
        const res = await request(app)
            .patch('/api/auth/users/1/role')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ rol_usu: 'superusuario' });

        expect(res.statusCode).toBe(400);
    });

    test('403 – admin intenta cambiar su propio rol', async () => {
        mockSessionVersionOnce(0);
        const res = await request(app)
            .patch('/api/auth/users/99/role')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ rol_usu: 'cliente' });

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toMatch(/tu propio rol/i);
    });

    test('404 – usuario no encontrado', async () => {
        mockSessionVersionOnce(0);
        db.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .patch('/api/auth/users/999/role')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ rol_usu: 'admin' });

        expect(res.statusCode).toBe(404);
        expect(res.body.error).toMatch(/no encontrado/i);
    });

    test('200 – cambio de rol exitoso', async () => {
        mockSessionVersionOnce(0);
        db.query.mockResolvedValueOnce({
            rows: [{ id_usu: 1, nom_usu: 'Ruben', correo_usu: 'r@test.com', rol_usu: 'admin' }]
        });

        const res = await request(app)
            .patch('/api/auth/users/1/role')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ rol_usu: 'admin' });

        expect(res.statusCode).toBe(200);
        expect(res.body.usuario).toHaveProperty('rol_usu', 'admin');
    });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/auth/forgot-password  — HU05
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/forgot-password', () => {
    const emailService = require('../config/emailService');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('400 – correo con formato inválido', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ correo_usu: 'no-es-un-email' });

        expect(res.statusCode).toBe(400);
    });

    test('200 – correo no existe (no revela si el correo está registrado)', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ correo_usu: 'noexiste@test.com' });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/si el correo está registrado/i);
        expect(emailService.sendPasswordResetCode).not.toHaveBeenCalled();
    });

    test('200 – correo existe: guarda token y envía email', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id_usu: 1, correo_usu: 'r@test.com' }] }) // findByEmail
            .mockResolvedValueOnce({ rows: [] }) // invalidateActiveResetTokens
            .mockResolvedValueOnce({ rows: [] }); // createResetToken

        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ correo_usu: 'r@test.com' });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/si el correo está registrado/i);
        expect(emailService.sendPasswordResetCode).toHaveBeenCalledWith(
            'r@test.com',
            expect.stringMatching(/^\d{6}$/)
        );
    });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/auth/verify-reset-code — HU05
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/verify-reset-code', () => {
    beforeEach(() => jest.clearAllMocks());

    test('400 – código inválido o expirado', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/verify-reset-code')
            .send({ correo_usu: 'r@test.com', code: '123456' });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/codigo es invalido/i);
    });

    test('200 – código válido', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id_usu: 1 }] });

        const res = await request(app)
            .post('/api/auth/verify-reset-code')
            .send({ correo_usu: 'r@test.com', code: '123456' });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/verificado/i);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/auth/reset-password  — HU05
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/reset-password', () => {

    beforeEach(() => jest.clearAllMocks());

    test('400 – campos faltantes (sin token)', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ new_password: 'nueva123' });

        expect(res.statusCode).toBe(400);
    });

    test('400 – contraseña muy corta', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ correo_usu: 'r@test.com', code: '123456', new_password: '123' });

        expect(res.statusCode).toBe(400);
    });

    test('400 – token inválido o expirado', async () => {
        const clientQuery = jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({ rows: [] }) // SELECT … FOR UPDATE → vacío
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
        db.connect.mockResolvedValueOnce({ query: clientQuery, release: jest.fn() });

        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ correo_usu: 'r@test.com', code: '123456', new_password: 'Nueva1!23' });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/invalido o ha expirado/i);
    });

    test('200 – contraseña restablecida exitosamente', async () => {
        const clientQuery = jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 1, id_usu: 5 }] }) // SELECT … FOR UPDATE
            .mockResolvedValueOnce({ rows: [{ id_usu: 5 }] }) // UPDATE Cliente
            .mockResolvedValueOnce({ rows: [] }) // UPDATE reset_tokens
            .mockResolvedValueOnce({ rows: [] }); // COMMIT
        db.connect.mockResolvedValueOnce({ query: clientQuery, release: jest.fn() });

        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ correo_usu: 'r@test.com', code: '123456', new_password: 'Nueva1!23' });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/restablecida exitosamente/i);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/auth/me/password — Cambiar contraseña (usuario autenticado)
// ════════════════════════════════════════════════════════════════════════════
describe('PATCH /api/auth/me/password', () => {
    let clienteToken;

    beforeAll(() => {
        const jwt = require('jsonwebtoken');
        clienteToken = jwt.sign(
            { id_usu: 7, correo_usu: 'cliente@test.com', rol_usu: 'cliente', sv: 0 },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await blacklist.resetForTests();
    });

    test('401 – sin token', async () => {
        const res = await request(app)
            .patch('/api/auth/me/password')
            .send({ current_password: 'abc123', new_password: 'Nueva1!23' });

        expect(res.statusCode).toBe(401);
    });

    test('400 – faltan campos obligatorios', async () => {
        mockSessionVersionOnce(0);
        const res = await request(app)
            .patch('/api/auth/me/password')
            .set('Authorization', `Bearer ${clienteToken}`)
            .send({ new_password: 'Nueva1!23' });

        expect(res.statusCode).toBe(400);
    });

    test('400 – nueva contraseña con menos de 6 caracteres', async () => {
        mockSessionVersionOnce(0);
        const res = await request(app)
            .patch('/api/auth/me/password')
            .set('Authorization', `Bearer ${clienteToken}`)
            .send({ current_password: 'abc123', new_password: '123' });

        expect(res.statusCode).toBe(400);
    });

    test('400 – nueva contraseña igual a la actual', async () => {
        mockSessionVersionOnce(0);
        const res = await request(app)
            .patch('/api/auth/me/password')
            .set('Authorization', `Bearer ${clienteToken}`)
            .send({ current_password: 'mismapass', new_password: 'mismapass' });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/no puede ser igual/i);
    });

    test('401 – contraseña actual incorrecta', async () => {
        const hash = await hashPassword('correcta123');
        mockSessionVersionOnce(0);
        db.query.mockResolvedValueOnce({
            rows: [{ id_usu: 7, password_usu: hash, activo: true }]
        });

        const res = await request(app)
            .patch('/api/auth/me/password')
            .set('Authorization', `Bearer ${clienteToken}`)
            .send({ current_password: 'incorrecta', new_password: 'Nueva1!23' });

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/contraseña actual es incorrecta/i);
    });

    test('200 – contraseña actualizada exitosamente', async () => {
        const hash = await hashPassword('Actual1!23');
        mockSessionVersionOnce(0);
        db.query
            .mockResolvedValueOnce({ rows: [{ id_usu: 7, password_usu: hash, activo: true }] }) // findByIdWithPassword
            .mockResolvedValueOnce({ rows: [] }); // updatePassword

        const res = await request(app)
            .patch('/api/auth/me/password')
            .set('Authorization', `Bearer ${clienteToken}`)
            .send({ current_password: 'Actual1!23', new_password: 'Nueva1!23' });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/actualizada exitosamente/i);
    });

    test('401 – tras cambiar contraseña el access token anterior queda revocado', async () => {
        const hash = await hashPassword('Actual1!23');
        mockSessionVersionOnce(0);
        db.query
            .mockResolvedValueOnce({ rows: [{ id_usu: 7, password_usu: hash, activo: true }] })
            .mockResolvedValueOnce({ rows: [] });

        const changeRes = await request(app)
            .patch('/api/auth/me/password')
            .set('Authorization', `Bearer ${clienteToken}`)
            .send({ current_password: 'Actual1!23', new_password: 'Nueva1!23' });

        expect(changeRes.statusCode).toBe(200);

        mockSessionVersionOnce(1);

        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${clienteToken}`);

        expect(meRes.statusCode).toBe(401);
        expect(meRes.body.error).toMatch(/ya no es válida|inicia sesión/i);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// Health / readiness
// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/users/health y /ready', () => {
    test('health responde 200', async () => {
        const res = await request(app).get('/api/users/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toMatch(/OK/i);
    });

    test('ready responde 200 cuando Postgres responde (Redis omitido en test)', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
        const res = await request(app).get('/api/users/ready');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ready');
        expect(res.body.checks).toEqual({ postgres: true, redis: true });
    });
});
