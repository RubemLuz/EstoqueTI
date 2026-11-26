const express = require('express');
const controller = require('../controllers/transferenciasController');
const router = express.Router();

router.get('/transferencias', controller.index);
router.post('/transferencias', controller.criar);
router.post('/transferencias/:id/enviar', controller.enviar);
router.post('/transferencias/:id/atender', controller.atender);
router.post('/transferencias/:id/rejeitar', controller.rejeitar);
router.post('/transferencias/:id/receber', controller.receber);

module.exports = router;