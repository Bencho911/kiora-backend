'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_js_1 = __importDefault(require("../config/db.js"));
const saveAlert = async ({ tipo, mensaje, metadata }) => {
    return db_js_1.default.query(`INSERT INTO Alerta (tipo, mensaje, metadata)
         VALUES ($1, $2, $3)
         RETURNING *`, [tipo, mensaje, metadata ? JSON.stringify(metadata) : null]);
};
const getAlerts = async ({ limit = 20, offset = 0, leida = null }) => {
    let query = 'SELECT * FROM Alerta';
    const params = [];
    if (leida !== null) {
        query += ' WHERE leida = $1';
        params.push(leida === 'true' || leida === true);
    }
    query += ` ORDER BY fecha_creacion DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    return db_js_1.default.query(query, params);
};
const markAsRead = async (id) => {
    return db_js_1.default.query(`UPDATE Alerta SET leida = TRUE WHERE id = $1 RETURNING *`, [id]);
};
exports.default = {
    saveAlert,
    getAlerts,
    markAsRead,
};
