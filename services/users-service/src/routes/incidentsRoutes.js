const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/incidentsController');

router.get('/', ctrl.getAll);
router.post('/', ctrl.createIncident);
router.put('/:id/estado', ctrl.updateIncidentState);
router.delete('/:id', ctrl.deleteIncident);

module.exports = router;
