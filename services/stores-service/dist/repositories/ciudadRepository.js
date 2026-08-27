"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("../config/db"));
async function findAll({ regional_id } = {}) {
    let query = `
        SELECT c.*, r.nombre AS regional_nombre 
        FROM Ciudad c
        JOIN Regional r ON c.fk_regional_id = r.id
    `;
    const params = [];
    if (regional_id) {
        query += ' WHERE c.fk_regional_id = $1';
        params.push(regional_id);
    }
    query += ' ORDER BY c.id ASC';
    const { rows } = await db_1.default.query(query, params);
    return rows;
}
async function findById(id) {
    const { rows } = await db_1.default.query(`
        SELECT c.*, r.nombre AS regional_nombre 
        FROM Ciudad c
        JOIN Regional r ON c.fk_regional_id = r.id
        WHERE c.id = $1
    `, [id]);
    return rows[0] || null;
}
async function create({ nombre, fk_regional_id }) {
    const { rows } = await db_1.default.query('INSERT INTO Ciudad (nombre, fk_regional_id) VALUES ($1, $2) RETURNING *', [nombre, fk_regional_id]);
    return rows[0];
}
async function update(id, { nombre, fk_regional_id }) {
    const { rows } = await db_1.default.query('UPDATE Ciudad SET nombre = COALESCE($1, nombre), fk_regional_id = COALESCE($2, fk_regional_id) WHERE id = $3 RETURNING *', [nombre, fk_regional_id, id]);
    return rows[0] || null;
}
async function remove(id) {
    const { rows } = await db_1.default.query('DELETE FROM Ciudad WHERE id = $1 RETURNING id', [id]);
    return rows[0]?.id || null;
}
exports.default = { findAll, findById, create, update, remove };
