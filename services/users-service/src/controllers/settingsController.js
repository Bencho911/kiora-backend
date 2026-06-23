const pool = require('../config/db');

// GET /api/settings
const getSettings = async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM ajustes_sistema WHERE id = 1');
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ajustes no encontrados' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// PUT /api/settings
const updateSettings = async (req, res, next) => {
    try {
        const { 
            cierre_caja_automatico, 
            hora_cierre_automatico, 
            metodo_descuento_lote, 
            dias_alerta_vencimiento 
        } = req.body;

        const updateQuery = `
            UPDATE ajustes_sistema
            SET 
                cierre_caja_automatico = COALESCE($1, cierre_caja_automatico),
                hora_cierre_automatico = COALESCE($2, hora_cierre_automatico),
                metodo_descuento_lote = COALESCE($3, metodo_descuento_lote),
                dias_alerta_vencimiento = COALESCE($4, dias_alerta_vencimiento)
            WHERE id = 1
            RETURNING *
        `;

        const values = [
            cierre_caja_automatico, 
            hora_cierre_automatico, 
            metodo_descuento_lote, 
            dias_alerta_vencimiento
        ];

        const result = await pool.query(updateQuery, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ajustes no encontrados' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSettings,
    updateSettings
};
