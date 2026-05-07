'use strict';

const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');

router.get('/daily', settlementController.getDailySettlement);

module.exports = router;
