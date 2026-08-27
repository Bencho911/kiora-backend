"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ciudadController_1 = __importDefault(require("../controllers/ciudadController"));
const router = (0, express_1.Router)();
router.get('/', ciudadController_1.default.listCiudades);
router.post('/', ciudadController_1.default.createCiudad);
router.get('/:id', ciudadController_1.default.getCiudad);
router.put('/:id', ciudadController_1.default.updateCiudad);
router.delete('/:id', ciudadController_1.default.deleteCiudad);
exports.default = router;
