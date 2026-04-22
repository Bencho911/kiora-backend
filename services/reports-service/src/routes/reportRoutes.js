const express = require('express');
const router = express.Router();
const { generateReceiptPdf } = require('../controllers/reportController');

router.get('/receipt/:orderId', generateReceiptPdf);

module.exports = router;
