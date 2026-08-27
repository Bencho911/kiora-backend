"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const regionController_1 = __importDefault(require("../controllers/regionController"));
const router = (0, express_1.Router)();
router.get('/', regionController_1.default.listRegiones);
router.post('/', regionController_1.default.createRegion);
router.get('/:id', regionController_1.default.getRegion);
router.put('/:id', regionController_1.default.updateRegion);
router.delete('/:id', regionController_1.default.deleteRegion);
exports.default = router;
