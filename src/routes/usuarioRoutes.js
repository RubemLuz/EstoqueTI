const express = require('express');
const controller = require('../controllers/usuarioController');
const { exigirPermissao } = require('../middlewares/autenticacao');

const router = express.Router();

router.get('/usuario', controller.index);

router.get('/usuario/permissoes', exigirPermissao('administracao'), controller.permissoes);
router.post('/usuario/permissoes/:id', exigirPermissao('administracao'), controller.salvarPermissoes);
router.post('/usuario/permissoes/:id/status', exigirPermissao('administracao'), controller.atualizarAtivo);
router.post('/usuario/permissoes/:id/senha', exigirPermissao('administracao'), controller.alterarSenha);
router.post('/usuario/permissoes/:id/codigo-seguranca', exigirPermissao('administracao'), controller.gerarCodigoSeguranca);
router.get('/usuario/novo', exigirPermissao('administracao'), controller.novo);
router.post('/usuario/novo', exigirPermissao('administracao'), controller.criar);
router.get('/usuario/dados', exigirPermissao('administracao'), controller.exclusaoDados);
router.post('/usuario/dados/excluir', exigirPermissao('administracao'), controller.excluirDados);

module.exports = router;
