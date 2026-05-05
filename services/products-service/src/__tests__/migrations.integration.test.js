/**
 * Tests de migraciones contra Postgres real (products-service).
 * RUN_MIGRATION_TESTS=true + DATABASE_URL o DB_* en CI.
 */
const { execSync } = require('child_process');
const path = require('path');
const { Pool } = require('pg');

const serviceRoot = path.resolve(__dirname, '..', '..');

const runDescribe = process.env.RUN_MIGRATION_TESTS === 'true' ? describe : describe.skip;

const ensureDatabaseUrl = () => {
    if (process.env.DATABASE_URL) return;
    const u = process.env.DB_USER || 'postgres';
    const p = process.env.DB_PASSWORD ?? '';
    const h = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '5432';
    const d = process.env.DB_NAME || 'postgres';
    process.env.DATABASE_URL = `postgres://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}:${port}/${d}`;
};

const poolConfig = () => {
    ensureDatabaseUrl();
    if (process.env.DATABASE_URL) {
        return { connectionString: process.env.DATABASE_URL };
    }
    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'postgres',
    };
};

const tableExists = async (pool, tableName) => {
    const r = await pool.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
    );
    return r.rows.length > 0;
};

const columnExists = async (pool, tableName, columnName) => {
    const r = await pool.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [tableName, columnName]
    );
    return r.rows.length > 0;
};

runDescribe('Migraciones SQL products-service (integración)', () => {
    let pool;

    beforeAll(() => {
        ensureDatabaseUrl();
        execSync('npx node-pg-migrate up --migrations-dir src/db/migrations', {
            cwd: serviceRoot,
            env: { ...process.env, NODE_ENV: 'development' },
            encoding: 'utf8',
            stdio: 'pipe',
        });
        pool = new Pool(poolConfig());
    });

    afterAll(async () => {
        if (pool) await pool.end();
    });

    test('pgmigrations registrada y migraciones 001–004', async () => {
        const exists = await tableExists(pool, 'pgmigrations');
        expect(exists).toBe(true);
        const { rows } = await pool.query('SELECT name FROM pgmigrations ORDER BY run_on');
        const names = rows.map((r) => r.name);
        expect(names.length).toBeGreaterThanOrEqual(4);
        expect(names.some((n) => n.includes('001'))).toBe(true);
        expect(names.some((n) => n.includes('004'))).toBe(true);
    });

    test('tablas categoria y producto', async () => {
        expect(await tableExists(pool, 'categoria')).toBe(true);
        expect(await tableExists(pool, 'producto')).toBe(true);
    });

    test('002: columnas de stock en producto', async () => {
        expect(await columnExists(pool, 'producto', 'stock_actual')).toBe(true);
        expect(await columnExists(pool, 'producto', 'stock_minimo')).toBe(true);
    });

    test('004: url_imagen en producto', async () => {
        expect(await columnExists(pool, 'producto', 'url_imagen')).toBe(true);
    });
});
