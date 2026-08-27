'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const validate_1 = __importDefault(require("../middlewares/validate"));
const categoryValidators_1 = require("../validators/categoryValidators");
const categoryController_1 = require("../controllers/categoryController");
/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Listar todas las categorías
 *     tags: [Categorías]
 *     responses:
 *       200:
 *         description: Array de categorías.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Categoria'
 */
router.get('/', categoryController_1.getCategories);
/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Detalle de una categoría
 *     tags: [Categorías]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Datos de la categoría.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Categoria'
 *       404:
 *         description: Categoría no encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', categoryController_1.getCategoryById);
/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Crear una categoría
 *     tags: [Categorías]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaInput'
 *     responses:
 *       201:
 *         description: Categoría creada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Categoria'
 *       400:
 *         description: nom_cat es obligatorio.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', (0, validate_1.default)(categoryValidators_1.createCategorySchema), categoryController_1.createCategory);
/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Actualizar una categoría
 *     tags: [Categorías]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaInput'
 *     responses:
 *       200:
 *         description: Categoría actualizada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Categoria'
 *       404:
 *         description: Categoría no encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', (0, validate_1.default)(categoryValidators_1.updateCategorySchema), categoryController_1.updateCategory);
/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Eliminar una categoría
 *     tags: [Categorías]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Categoría eliminada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Categoría eliminada exitosamente.
 *       404:
 *         description: Categoría no encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', categoryController_1.deleteCategory);
exports.default = router;
