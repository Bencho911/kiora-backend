"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = __importDefault(require("../config/db.js"));
const router = (0, express_1.Router)();
// POST /api/activity-logs — registrar evento
router.post('/', async (req, res, next) => {
    try {
        const { user_email, user_name, action, entity_type, entity_id, details } = req.body;
        if (!user_email || !action || !entity_type) {
            return res.status(400).json({ error: 'user_email, action y entity_type son requeridos' });
        }
        const result = await db_js_1.default.query(`INSERT INTO activity_log (user_email, user_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [user_email, user_name || null, action, entity_type, entity_id || null, details || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/activity-logs — consultar historial
router.get('/', async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
        const offset = (page - 1) * limit;
        const countResult = await db_js_1.default.query('SELECT COUNT(*) FROM activity_log');
        const total = parseInt(countResult.rows[0].count);
        const result = await db_js_1.default.query(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
        res.json({
            data: result.rows,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
