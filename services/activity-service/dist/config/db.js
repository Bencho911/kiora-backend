"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'kiora_activity',
    password: process.env.DB_PASSWORD || 'rootpassword',
    port: Number(process.env.DB_PORT) || 5432,
    max: 10,
    connectionTimeoutMillis: 5000,
});
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});
exports.default = pool;
