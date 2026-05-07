'use strict';

const alertRepository = require('../repositories/alertRepository');
const logger = require('../config/logger');

const getAlerts = async (req, res, next) => {
    try {
        const { limit, offset, leida } = req.query;
        const limitNum = parseInt(limit, 10) || 20;
        const offsetNum = parseInt(offset, 10) || 0;
        
        let leidaParam = null;
        if (leida !== undefined) {
            leidaParam = leida === 'true';
        }

        const result = await alertRepository.getAlerts({ limit: limitNum, offset: offsetNum, leida: leidaParam });
        res.status(200).json({ alerts: result.rows });
    } catch (error) {
        next(error);
    }
};

const markAlertAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await alertRepository.markAsRead(id);
        
        if (result.rows.length === 0) {
            const err = new Error('Alerta no encontrada');
            err.status = 404;
            throw err;
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAlerts,
    markAlertAsRead,
};
