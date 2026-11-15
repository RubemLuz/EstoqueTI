const express = require('express');
const homeRoutes = require('./src/routes/homeRoutes');
const entradaEstoqueRoutes = require('./src/routes/entradaEstoqueRoutes');
const loginRoutes = require('./src/routes/loginRoutes');
const suprimentosRoutes = require('./src/routes/suprimentosRoutes');
const requisicoesRoutes = require('./src/routes/requisicoesSuprimentosRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes');
const { autenticar, validarFilial, exigirPermissao } = require('./src/middlewares/autenticacao');

const router = express.Router();

router.use('/', loginRoutes);
router.use(autenticar);
router.use(validarFilial);
router.use('/', usuarioRoutes);
router.use((req, res, next) => {
  const { method, path } = req;
  let permissoes;

  if (path === '/') {
    permissoes = ['estoque'];
  } else if (path === '/suprimentos' || path.startsWith('/suprimentos/')) {
    if (method === 'POST' && /^\/suprimentos\/[^/]+\/desativar$/.test(path)) {
      permissoes = ['suprimentos', 'suprimentosExcluir'];
    } else if (method === 'POST') {
      permissoes = ['suprimentos', 'suprimentosEditar'];
    } else {
      permissoes = ['suprimentos'];
    }
  } else if (path === '/entrada_estoque' || path.startsWith('/entrada_estoque/')
    || ['/adicionar_estoque', '/editar_estoque', '/excluir_estoque'].some((legacyPath) =>
      path === legacyPath || path.startsWith(`${legacyPath}/`))) {
    if (method === 'POST' && (/^\/(entrada_estoque|excluir_estoque)\/[^/]+\/desativar$/.test(path)
      || /^\/excluir_estoque\/[^/]+$/.test(path))) {
      permissoes = ['estoque', 'estoqueExcluir'];
    } else if (method === 'POST') {
      permissoes = ['estoque', 'estoqueEditar'];
    } else {
      permissoes = ['estoque'];
    }
  } else if (path === '/requisicoes-suprimentos' || path.startsWith('/requisicoes-suprimentos/')) {
    permissoes = ['requisicoes'];
  }

  if (!permissoes) return next();
  return exigirPermissao(permissoes)(req, res, next);
});
router.use('/', homeRoutes);
router.use('/', entradaEstoqueRoutes);
router.use('/', suprimentosRoutes);
router.use('/', requisicoesRoutes);

module.exports = router;