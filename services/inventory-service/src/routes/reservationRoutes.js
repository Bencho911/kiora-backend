'use strict';
const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');

router.post('/reserve', reservationController.reserveInventory);
router.post('/reserve/commit', reservationController.commitReservation);
router.post('/reserve/rollback', reservationController.rollbackReservation);

module.exports = router;
