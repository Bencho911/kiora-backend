'use strict';

const db = require('../config/db');

const saveAlert = async ({ tipo, mensaje, metadata }) => {
    return db.query(
        `INSERT INTO Alerta (tipo, mensaje, metadata)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [tipo, mensaje, metadata ? JSON.stringify(metadata) : null]
    );
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
    
    return db.query(query, params);
};

const markAsRead = async (id) => {
    return db.query(
        `UPDATE Alerta SET leida = TRUE WHERE id = $1 RETURNING *`,
        [id]
    );
};

module.exports = {
    saveAlert,
    getAlerts,
    markAsRead,
};
