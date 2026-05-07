'use strict';

const db = require('../config/db');

const getDailySettlement = async (dateString) => {
    return db.query(
        `SELECT 
            metodopago_usu as metodo_pago,
            COUNT(*) as cantidad_ventas,
            SUM(montofinal_vent) as total_ingresos
         FROM Ventas
         WHERE DATE(fecha_vent) = $1
           AND estado = 'completada'
         GROUP BY metodopago_usu`,
        [dateString]
    );
};

module.exports = {
    getDailySettlement,
};
