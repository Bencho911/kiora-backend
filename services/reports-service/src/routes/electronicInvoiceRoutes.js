'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/electronicInvoiceController');

router.get('/:id_vent', controller.generateElectronicInvoice);

module.exports = router;
