const express = require('express');
const controller = require('../controllers/entradaEstoqueController');
const router = express.Router();

router.get('/entrada_estoque', controller.index);
router.get('/entrada_estoque/relatorio', controller.relatorio);
router.post('/entrada_estoque', controller.criar);
router.post('/entrada_estoque/:id/editar', controller.editar);
router.post('/entrada_estoque/:id/desativar', controller.desativar);

router.get(['/adicionar_estoque', '/editar_estoque', '/excluir_estoque'], (req, res) => {
  res.redirect(`/entrada_estoque?filial=${req.filial}`);
});
router.post('/adicionar_estoque', controller.criar);
router.post('/editar_estoque/:id', controller.editar);
router.post('/excluir_estoque/:id', controller.desativar);

module.exports = router;
