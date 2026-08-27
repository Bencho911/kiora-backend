"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailySettlement = void 0;
const settlementRepository = __importStar(require("../repositories/settlementRepository"));
const getDailySettlement = async (req, res, next) => {
    try {
        let dateString = req.query.date;
        // Si no se provee fecha, usar la de hoy
        if (!dateString) {
            const today = new Date();
            dateString = today.toISOString().split('T')[0];
        }
        // Validación simple de formato YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateString)) {
            const err = new Error('El formato de la fecha debe ser YYYY-MM-DD');
            err.status = 400;
            throw err;
        }
        const result = await settlementRepository.getDailySettlement(dateString);
        // Calcular el total absoluto sumando todos los métodos de pago
        const total_general = result.rows.reduce((acc, row) => acc + Number(row.total_ingresos), 0);
        const total_boletas = result.rows.reduce((acc, row) => acc + Number(row.cantidad_ventas), 0);
        res.status(200).json({
            fecha: dateString,
            total_general,
            total_boletas,
            desglose_metodos_pago: result.rows.map((r) => ({
                metodo_pago: r.metodo_pago || 'Desconocido',
                cantidad_ventas: Number(r.cantidad_ventas),
                total_ingresos: Number(r.total_ingresos)
            }))
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getDailySettlement = getDailySettlement;
