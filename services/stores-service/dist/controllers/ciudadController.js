"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ciudadRepository_1 = __importDefault(require("../repositories/ciudadRepository"));
const logger_1 = __importDefault(require("../config/logger"));
async function listCiudades(req, res, next) {
    try {
        const regional_id = req.query.regional_id ? Number(req.query.regional_id) : undefined;
        const ciudades = await ciudadRepository_1.default.findAll({ regional_id });
        res.json({ data: ciudades, total: ciudades.length });
    }
    catch (err) {
        next(err);
    }
}
async function getCiudad(req, res, next) {
    try {
        const ciudad = await ciudadRepository_1.default.findById(Number(req.params.id));
        if (!ciudad)
            return res.status(404).json({ error: 'Ciudad no encontrada', code: 'NOT_FOUND' });
        res.json({ data: ciudad });
    }
    catch (err) {
        next(err);
    }
}
async function createCiudad(req, res, next) {
    try {
        const { nombre, fk_regional_id } = req.body;
        if (!nombre || !fk_regional_id)
            return res.status(400).json({ error: 'El nombre y la regional son requeridos', code: 'VALIDATION_ERROR' });
        const ciudad = await ciudadRepository_1.default.create({ nombre, fk_regional_id });
        logger_1.default.info('Ciudad creada', { id: ciudad.id, nombre: ciudad.nombre, regional: ciudad.fk_regional_id });
        res.status(201).json({ data: ciudad });
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ya existe una ciudad con ese nombre en esta regional', code: 'DUPLICATE' });
        }
        next(err);
    }
}
async function updateCiudad(req, res, next) {
    try {
        const id = Number(req.params.id);
        const ciudad = await ciudadRepository_1.default.update(id, req.body);
        if (!ciudad)
            return res.status(404).json({ error: 'Ciudad no encontrada', code: 'NOT_FOUND' });
        logger_1.default.info('Ciudad actualizada', { id: ciudad.id });
        res.json({ data: ciudad });
    }
    catch (err) {
        next(err);
    }
}
async function deleteCiudad(req, res, next) {
    try {
        const id = Number(req.params.id);
        const ciudad = await ciudadRepository_1.default.remove(id);
        if (!ciudad)
            return res.status(404).json({ error: 'Ciudad no encontrada', code: 'NOT_FOUND' });
        logger_1.default.info('Ciudad eliminada', { id });
        res.json({ message: 'Ciudad eliminada con éxito' });
    }
    catch (err) {
        if (err.code === '23503') { // Foreign key constraint violation
            return res.status(409).json({ error: 'No se puede eliminar la ciudad porque tiene centros de operación asociados.', code: 'FK_VIOLATION' });
        }
        next(err);
    }
}
exports.default = { listCiudades, getCiudad, createCiudad, updateCiudad, deleteCiudad };
