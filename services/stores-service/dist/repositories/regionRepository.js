"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("../config/db"));
async function findAll() {
    const { rows } = await db_1.default.query('SELECT * FROM Regional ORDER BY id ASC');
    return rows;
}
async function findById(id) {
    const { rows } = await db_1.default.query('SELECT * FROM Regional WHERE id = $1', [id]);
    return rows[0] || null;
}
async function create({ nombre }) {
    const { rows } = await db_1.default.query('INSERT INTO Regional (nombre) VALUES ($1) RETURNING *', [nombre]);
    return rows[0];
}
async function update(id, { nombre }) {
    const { rows } = await db_1.default.query('UPDATE Regional SET nombre = COALESCE($1, nombre) WHERE id = $2 RETURNING *', [nombre, id]);
    return rows[0] || null;
}
async function remove(id) {
    const { rows } = await db_1.default.query('DELETE FROM Regional WHERE id = $1 RETURNING id', [id]);
    return rows[0]?.id || null;
}
exports.default = { findAll, findById, create, update, remove };
