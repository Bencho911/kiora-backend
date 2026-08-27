import { Request, Response, NextFunction } from 'express';
import * as settlementRepository from '../repositories/settlementRepository';

export const getDailySettlement = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let dateString = req.query.date;
        
        // Si no se provee fecha, usar la de hoy
        if (!dateString) {
            const today = new Date();
            dateString = today.toISOString().split('T')[0];
        }

        // Validación simple de formato YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString as string)) {
            const err: any = new Error('El formato de la fecha debe ser YYYY-MM-DD');
            err.status = 400;
            throw err;
        }

        const result = await settlementRepository.getDailySettlement(dateString as string);
        
        // Calcular el total absoluto sumando todos los métodos de pago
        const total_general = result.rows.reduce((acc: number, row: any) => acc + Number(row.total_ingresos), 0);
        const total_boletas = result.rows.reduce((acc: number, row: any) => acc + Number(row.cantidad_ventas), 0);

        res.status(200).json({
            fecha: dateString,
            total_general,
            total_boletas,
            desglose_metodos_pago: result.rows.map((r: any) => ({
                metodo_pago: r.metodo_pago || 'Desconocido',
                cantidad_ventas: Number(r.cantidad_ventas),
                total_ingresos: Number(r.total_ingresos)
            }))
        });
    } catch (error: unknown) {
        next(error);
    }
};
