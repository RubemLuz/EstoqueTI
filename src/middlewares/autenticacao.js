const Usuario = require('../models/Usuario');

const autenticar = async (req, res, next) => {
  if (!req.session.usuarioId) {
    return res.redirect('/login');
  }

  try {
    const usuario = await Usuario.findById(req.session.usuarioId)
      .select('nome usuario permissoes filiais administrador ativo');

    if (!usuario) {
      return req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie('connect.sid');
        res.redirect('/login');
      });
    }
    if (!usuario.ativo) {
      req.flash('error', 'Sua conta foi desativada e não pode acessar o sistema.');
      delete req.session.usuarioId;
      return req.session.save((error) => {
        if (error) return next(error);
        res.redirect('/login');
      });
    }

    req.usuario = usuario;
    res.locals.usuario = usuario;
    res.locals.permissoes = usuario.permissoes;
    res.locals.filiaisPermitidas = usuario.administrador ? [1, 3, 4] : usuario.filiais;
    next();
  } catch (error) {
    next(error);
  }
};

const validarFilial = (req, res, next) => {
  const rotasComFilial = new Set([
    '/',
    '/entrada_estoque',
    '/editar_estoque',
    '/adicionar_estoque',
    '/excluir_estoque',
    '/suprimentos',
    '/suprimentos/relatorio',
    '/requisicoes-suprimentos',
    '/requisicoes-estoque',
    '/saidas-produtos',
    '/saidas-suprimentos'
  ]);
  const rotaComFilial = rotasComFilial.has(req.path)
    || ['/entrada_estoque/', '/editar_estoque/', '/adicionar_estoque/', '/excluir_estoque/', '/suprimentos/', '/requisicoes-estoque/', '/saidas-produtos/', '/saidas-suprimentos/']
      .some((prefixo) => req.path.startsWith(prefixo));
  if (!rotaComFilial) return next();

  const filiaisPermitidas = req.usuario.administrador
    ? [1, 3, 4]
    : (req.usuario.filiais || []).filter((filial) => [1, 3, 4].includes(filial));
  if (!filiaisPermitidas.length) {
    return res.status(403).render('error', {
      title: 'Acesso não permitido',
      message: 'Sua conta não tem acesso a nenhuma filial. Peça a um administrador para configurar suas filiais.'
    });
  }

  const filialInformada = req.query.filial ?? req.body?.filial;
  const filialSolicitada = filialInformada === undefined
    ? Number(req.session.filialSelecionada)
    : Number(filialInformada);
  const filial = filiaisPermitidas.includes(filialSolicitada)
    ? filialSolicitada
    : filiaisPermitidas[0];

  if (req.method === 'GET' && filialSolicitada !== filial) {
    const parametros = new URLSearchParams(req.url.split('?')[1] || '');
    parametros.set('filial', String(filial));
    return res.redirect(302, `${req.path}?${parametros.toString()}`);
  }

  if (req.method !== 'GET' && filialInformada !== undefined
    && !filiaisPermitidas.includes(Number(filialInformada))) {
    return res.status(403).render('error', {
      title: 'Acesso não permitido',
      message: 'Sua conta não tem acesso à filial solicitada.'
    });
  }

  req.filial = filial;
  req.session.filialSelecionada = filial;
  res.locals.filial = filial;
  if (req.method !== 'GET' && req.body && req.body.filial === undefined) {
    req.body.filial = filial;
  }
  next();
};

const permissaoPermitida = (usuario, permissao) => {
  const valor = usuario?.permissoes?.[permissao];
  if (valor !== undefined) return valor;

  const permissaoBase = {
    estoqueEditar: 'estoque',
    estoqueExcluir: 'estoque',
    suprimentosEditar: 'suprimentos',
    suprimentosExcluir: 'suprimentos'
  }[permissao];
  return permissaoBase ? Boolean(usuario?.permissoes?.[permissaoBase]) : false;
};

const exigirPermissao = (permissoes) => (req, res, next) => {
  const exigidas = Array.isArray(permissoes) ? permissoes : [permissoes];
  if (req.usuario?.administrador || exigidas.every((permissao) =>
    permissaoPermitida(req.usuario, permissao)
  )) {
    return next();
  }

  res.status(403).render('error', {
    title: 'Acesso não permitido',
    message: 'Sua conta não tem permissão para acessar esta área.'
  });
};

module.exports = { autenticar, validarFilial, exigirPermissao };
