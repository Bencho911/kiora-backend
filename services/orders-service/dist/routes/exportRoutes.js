"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const exportController_1 = require("../controllers/exportController");
const router = express_1.default.Router();
/**
 * @swagger
 * /export/full:
 *   get:
 *     summary: Dataset completo de ventas (uso interno)
 *     description: >
 *       Retorna toda la información denormalizada de ventas, detalle de productos
 *       y facturas. Diseñado para consumo interno por reports-service.
 *     tags: [Export]
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicio (ISO 8601)
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin (ISO 8601)
 *     responses:
 *       200:
 *         description: Dataset exportado exitosamente
 *       500:
 *         description: Error interno
 */
router.get('/full', exportController_1.getFullExport);
exports.default = router;
