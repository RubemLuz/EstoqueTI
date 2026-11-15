const express = require('express');
const controller = require('../controllers/saidasController');
const router = express.Router();

router.get('/saidas-produtos', controller.indexProdutos);
router.post('/saidas-produtos', controller.criarSaidaProdutos);
router.get('/saidas-suprimentos', controller.indexSuprimentos);
router.post('/saidas-suprimentos', controller.criarSaidaSuprimentos);
router.get('/saidas-suprimentos/relatorio', controller.relatorioSuprimentos);

module.exports = router;
