"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailySettlement = void 0;
const db_1 = __importDefault(require("../config/db"));
/**
 * settlementRepository
 * Se encarga de las consultas agregadas para el cierre de caja (liquidación).
 */
/**
 * Obtiene la suma de ventas de un día específico.
 * Filtra solo por ventas con estado 'completada'.
 * @param {string} dateString - YYYY-MM-DD
 */
const getDailySettlement = async (dateString) => {
    // castear a DATE para comparar con el inicio y fin del día o simplemente ::date = $1
    return db_1.default.query(`SELECT 
            metodopago_usu as metodo_pago,
            COUNT(*) as cantidad_ventas,
            SUM(montofinal_vent) as total_ingresos
         FROM Ventas
         WHERE DATE(fecha_vent) = $1
           AND estado = 'completada'
         GROUP BY metodopago_usu`, [dateString]);
};
exports.getDailySettlement = getDailySettlement;
