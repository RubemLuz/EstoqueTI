const express = require('express');
const controller = require('../controllers/suprimentosController');
const router = express.Router();

// Tela, relatório e operações de cadastro/edição/desativação de suprimentos.
router.get('/suprimentos', controller.index);
router.get('/suprimentos/relatorio', controller.relatorio);
router.post('/suprimentos', controller.criar);
router.post('/suprimentos/:id/editar', controller.editar);
router.post('/suprimentos/:id/desativar', controller.desativar);

module.exports = router;
