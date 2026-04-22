const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');
require('../config/env');

if (process.env.NODE_ENV === 'production') {
    throw new Error('El script de seed no debe ejecutarse en producción.');
}

const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'postgres',
            password: process.env.DB_PASSWORD || '',
            port: parseInt(process.env.DB_PORT || '5432', 10),
        }
);

const seedUsers = [
    {
        nom_usu: process.env.SEED_ADMIN_NAME || 'Admin Kiora',
        correo_usu: process.env.SEED_ADMIN_EMAIL || 'admin@kiora.com',
        password: process.env.SEED_ADMIN_PASSWORD,
        rol_usu: 'admin',
        tel_usu: process.env.SEED_ADMIN_PHONE || null,
    },
    {
        nom_usu: process.env.SEED_SUPPORT_NAME || 'Soporte Kiora',
        correo_usu: process.env.SEED_SUPPORT_EMAIL || 'soporte@kiora.com',
        password: process.env.SEED_SUPPORT_PASSWORD,
        rol_usu: 'admin',
        tel_usu: process.env.SEED_SUPPORT_PHONE || null,
    },
];

const validateSeedPasswords = () => {
    const missing = seedUsers.filter((u) => !u.password).map((u) => u.correo_usu);
    if (missing.length > 0) {
        throw new Error(
            `Faltan contraseñas de seed. Define SEED_ADMIN_PASSWORD y SEED_SUPPORT_PASSWORD. Usuarios afectados: ${missing.join(', ')}`
        );
    }
};

async function upsertUser(user) {
    const existing = await pool.query(
        'SELECT id_usu FROM Cliente WHERE correo_usu = $1 AND activo = true',
        [user.correo_usu]
    );
    if (existing.rows.length > 0) {
        logger.info(`Usuario ya existente, se omite: ${user.correo_usu}`);
        return;
    }

    const hashedPassword = await bcrypt.hash(user.password, 10);
    await pool.query(
        `INSERT INTO Cliente (nom_usu, correo_usu, password_usu, rol_usu, tel_usu)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.nom_usu, user.correo_usu, hashedPassword, user.rol_usu, user.tel_usu]
    );
    logger.info(`Usuario seed creado: ${user.correo_usu}`);
}

async function seed() {
    try {
        validateSeedPasswords();
        logger.info('Iniciando seed de usuarios en entorno no productivo...');
        for (const user of seedUsers) {
            await upsertUser(user);
        }
        logger.info('Seed completado.');
    } catch (error) {
        logger.error('Error durante el seed:', { error: error.message });
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

seed();
