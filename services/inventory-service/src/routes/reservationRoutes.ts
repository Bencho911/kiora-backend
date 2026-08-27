'use strict';
import express from 'express';
const router = express.Router();
import reservationController from '../controllers/reservationController';

router.post('/reserve', reservationController.reserveInventory);
router.post('/reserve/commit', reservationController.commitReservation);
router.post('/reserve/rollback', reservationController.rollbackReservation);

export default router;
