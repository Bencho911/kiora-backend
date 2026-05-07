'use strict';

/**
 * Middleware que normaliza campos de FormData antes de que Joi los valide.
 * Multer deja todos los campos como strings; Joi puede convertir números
 * pero NO puede parsear un array serializado como JSON string.
 * Este middleware convierte:
 *   - fk_cod_cats: '[]' | '[1,2]'  →  number[]
 */
const parseFormData = (req, _res, next) => {
    if (req.body && typeof req.body.fk_cod_cats === 'string') {
        try {
            const parsed = JSON.parse(req.body.fk_cod_cats);
            req.body.fk_cod_cats = Array.isArray(parsed)
                ? parsed.map(Number)
                : [Number(parsed)];
        } catch {
            // Si no es JSON válido, intentamos tratarlo como un número suelto
            const n = Number(req.body.fk_cod_cats);
            req.body.fk_cod_cats = isNaN(n) ? [] : [n];
        }
    }
    next();
};

module.exports = parseFormData;
