"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const regionRepository_1 = __importDefault(require("../repositories/regionRepository"));
const logger_1 = __importDefault(require("../config/logger"));
async function listRegiones(req, res, next) {
    try {
        const regiones = await regionRepository_1.default.findAll();
        res.json({ data: regiones, total: regiones.length });
    }
    catch (err) {
        next(err);
    }
}
async function getRegion(req, res, next) {
    try {
        const region = await regionRepository_1.default.findById(Number(req.params.id));
        if (!region)
            return res.status(404).json({ error: 'Regional no encontrada', code: 'NOT_FOUND' });
        res.json({ data: region });
    }
    catch (err) {
        next(err);
    }
}
async function createRegion(req, res, next) {
    try {
        const { nombre } = req.body;
        if (!nombre)
            return res.status(400).json({ error: 'El nombre es requerido', code: 'VALIDATION_ERROR' });
        const region = await regionRepository_1.default.create({ nombre });
        logger_1.default.info('Regional creada', { id: region.id, nombre: region.nombre });
        res.status(201).json({ data: region });
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ya existe una regional con ese nombre', code: 'DUPLICATE' });
        }
        next(err);
    }
}
async function updateRegion(req, res, next) {
    try {
        const id = Number(req.params.id);
        const region = await regionRepository_1.default.update(id, req.body);
        if (!region)
            return res.status(404).json({ error: 'Regional no encontrada', code: 'NOT_FOUND' });
        logger_1.default.info('Regional actualizada', { id: region.id });
        res.json({ data: region });
    }
    catch (err) {
        next(err);
    }
}
async function deleteRegion(req, res, next) {
    try {
        const id = Number(req.params.id);
        const region = await regionRepository_1.default.remove(id);
        if (!region)
            return res.status(404).json({ error: 'Regional no encontrada', code: 'NOT_FOUND' });
        logger_1.default.info('Regional eliminada', { id });
        res.json({ message: 'Regional eliminada con éxito' });
    }
    catch (err) {
        if (err.code === '23503') { // Foreign key constraint violation
            return res.status(409).json({ error: 'No se puede eliminar la regional porque tiene ciudades asociadas.', code: 'FK_VIOLATION' });
        }
        next(err);
    }
}
exports.default = { listRegiones, getRegion, createRegion, updateRegion, deleteRegion };
