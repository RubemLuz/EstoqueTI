const express = require('express');
const controller = require('../controllers/requisicoesSuprimentosController');
const router = express.Router();

router.get('/requisicoes-suprimentos', controller.index);
router.post('/requisicoes-suprimentos', controller.criar);
router.post('/requisicoes-suprimentos/:id/receber', controller.receber);
router.post('/requisicoes-suprimentos/:id/excluir', controller.excluir);

module.exports = router;
