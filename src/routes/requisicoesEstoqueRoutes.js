const express = require('express');
const controller = require('../controllers/requisicoesEstoqueController');
const router = express.Router();

router.get('/requisicoes-estoque', controller.index);
router.post('/requisicoes-estoque', controller.criar);
router.post('/requisicoes-estoque/:id/receber', controller.receber);
router.post('/requisicoes-estoque/:id/excluir', controller.excluir);

module.exports = router;
