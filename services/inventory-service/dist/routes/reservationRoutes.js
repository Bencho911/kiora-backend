'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const reservationController_1 = __importDefault(require("../controllers/reservationController"));
router.post('/reserve', reservationController_1.default.reserveInventory);
router.post('/reserve/commit', reservationController_1.default.commitReservation);
router.post('/reserve/rollback', reservationController_1.default.rollbackReservation);
exports.default = router;
