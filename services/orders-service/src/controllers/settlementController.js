'use strict';

const settlementRepository = require('../repositories/settlementRepository');

const getDailySettlement = async (req, res, next) => {
    try {
        let dateString = req.query.date;
        
        if (!dateString) {
            const today = new Date();
            dateString = today.toISOString().split('T')[0];
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) {
            const err = new Error('El formato de la fecha debe ser YYYY-MM-DD');
            err.status = 400;
            throw err;
        }

        const result = await settlementRepository.getDailySettlement(dateString);
        
        const total_general = result.rows.reduce((acc, row) => acc + Number(row.total_ingresos), 0);
        const total_boletas = result.rows.reduce((acc, row) => acc + Number(row.cantidad_ventas), 0);

        res.status(200).json({
            fecha: dateString,
            total_general,
            total_boletas,
            desglose_metodos_pago: result.rows.map(r => ({
                metodo_pago: r.metodo_pago || 'Desconocido',
                cantidad_ventas: Number(r.cantidad_ventas),
                total_ingresos: Number(r.total_ingresos)
            }))
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDailySettlement,
};
