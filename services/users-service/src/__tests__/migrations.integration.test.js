/**
 * Tests de migraciones contra Postgres real.
 *
 * No se ejecutan en la suite normal (`npm test`): requieren RUN_MIGRATION_TESTS=true
 * y variables DB_* (o DATABASE_URL) apuntando a una base vacía o ya migrada.
 *
 * CI: job dedicado con servicio PostgreSQL.
 */
const { execSync } = require('child_process');
const path = require('path');
const { Pool } = require('pg');

const serviceRoot = path.resolve(__dirname, '..', '..');

const runDescribe = process.env.RUN_MIGRATION_TESTS === 'true' ? describe : describe.skip;

/** node-pg-migrate 8 exige DATABASE_URL si no hay .env completo */
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

runDescribe('Migraciones SQL (integración Postgres)', () => {
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

    test('tabla pgmigrations registrada', async () => {
        const exists = await tableExists(pool, 'pgmigrations');
        expect(exists).toBe(true);
        const { rows } = await pool.query('SELECT name FROM pgmigrations ORDER BY run_on');
        const names = rows.map((r) => r.name);
        expect(names.length).toBeGreaterThanOrEqual(8);
        expect(names.some((n) => n.includes('001'))).toBe(true);
        expect(names.some((n) => n.includes('006'))).toBe(true);
        expect(names.some((n) => n.includes('007'))).toBe(true);
        expect(names.some((n) => n.includes('008'))).toBe(true);
    });

    test('esquema base: Cliente presente', async () => {
        expect(await tableExists(pool, 'cliente')).toBe(true);
    });

    test('002: columnas de bloqueo en cliente', async () => {
        expect(await columnExists(pool, 'cliente', 'intentos_fallidos')).toBe(true);
        expect(await columnExists(pool, 'cliente', 'bloqueado_hasta')).toBe(true);
    });

    test('003: columna activo en cliente', async () => {
        expect(await columnExists(pool, 'cliente', 'activo')).toBe(true);
    });

    test('004: tabla reset_tokens', async () => {
        expect(await tableExists(pool, 'reset_tokens')).toBe(true);
        expect(await columnExists(pool, 'reset_tokens', 'token')).toBe(true);
        expect(await columnExists(pool, 'reset_tokens', 'usado')).toBe(true);
    });

    test('005: índice único parcial de correo activo', async () => {
        const { rows } = await pool.query(
            `SELECT indexname FROM pg_indexes
             WHERE schemaname = 'public' AND tablename = 'cliente'
             AND indexname = 'uq_cliente_correo_activo'`
        );
        expect(rows.length).toBe(1);
    });

    test('006: session_version en cliente', async () => {
        expect(await columnExists(pool, 'cliente', 'session_version')).toBe(true);
        const { rows } = await pool.query(
            'SELECT data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3',
            ['public', 'cliente', 'session_version']
        );
        expect(rows[0].data_type).toMatch(/integer/i);
    });

    test('007: reset_tokens.token ya no es UNIQUE global', async () => {
        const { rows } = await pool.query(
            `SELECT indexname
             FROM pg_indexes
             WHERE schemaname = 'public'
               AND tablename = 'reset_tokens'
               AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
               AND indexdef ILIKE '%(token)%'`
        );
        expect(rows.length).toBe(0);
    });

    test('008: tablas de otros dominios eliminadas de users-service', async () => {
        expect(await tableExists(pool, 'categoria')).toBe(false);
        expect(await tableExists(pool, 'producto')).toBe(false);
        expect(await tableExists(pool, 'inventario')).toBe(false);
        expect(await tableExists(pool, 'ventas')).toBe(false);
    });

    test('migrate up es idempotente (segunda ejecución sin error)', () => {
        ensureDatabaseUrl();
        const out = execSync('npx node-pg-migrate up --migrations-dir src/db/migrations', {
            cwd: serviceRoot,
            env: { ...process.env, NODE_ENV: 'development' },
            encoding: 'utf8',
        });
        expect(out).toMatch(/No migrations to run|migrations complete/i);
    });
});
