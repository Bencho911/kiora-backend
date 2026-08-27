import { Request, Response, NextFunction } from 'express';
import * as exportRepo from '../repositories/exportRepository';
import logger from '../config/logger';

/**
 * exportController
 * Endpoint interno consumido por reports-service para obtener
 * el dataset completo de ventas para exportación a Power BI.
 */

// GET /api/orders/export/full
export const getFullExport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters: any = {
            desde: (req.query.desde as string) || null,
            hasta: (req.query.hasta as string) || null,
        };

        logger.info('Exportación completa solicitada', { filters });

        const [fullData, summary, byPayment, byDay] = await Promise.all([
            exportRepo.findFullExport(filters),
            exportRepo.findSummary(filters),
            exportRepo.findByPaymentMethod(filters),
            exportRepo.findByDay(filters),
        ]);

        res.status(200).json({
            generado_en: new Date().toISOString(),
            filtros: filters,
            resumen: summary.rows[0],
            ventas_por_metodo_pago: byPayment.rows,
            ventas_por_dia: byDay.rows,
            dataset: fullData.rows,
        });
    } catch (error: unknown) {
        logger.error('error', { error: (error as Error).message });
        next(error);
    }
};
