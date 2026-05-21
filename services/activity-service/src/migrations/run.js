const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'kiora_activity',
  password: process.env.DB_PASSWORD || 'rootpassword',
  port: Number(process.env.DB_PORT) || 5432,
});

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '001_create_activity_log.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Migration 001_create_activity_log.sql executed successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
