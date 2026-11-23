const bcrypt = require('bcrypt');
const { randomInt } = require('crypto');
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const ItemEstoque = require('../models/ItemEstoque');
const Suprimento = require('../models/Suprimento');
const RequisicaoSuprimento = require('../models/RequisicaoSuprimento');

const gerarCodigoSeguranca = () => String(randomInt(0, 100000)).padStart(5, '0');

const filiaisDoFormulario = (valor) => {
  const valores = Array.isArray(valor)
    ? valor
    : typeof valor === 'string' ? [valor] : [];
  const filiais = [...new Set(valores.map(Number))];
  return filiais.length && filiais.every((filial) => [1, 3, 4].includes(filial))
    ? filiais
    : [];
};

exports.index = (req, res) => {
  res.render('usuario', {
    title: 'Minha conta',
    activePage: 'usuario'
  });
};

exports.permissoes = async (req, res, next) => {
  try {
    const usuarios = await Usuario.find({})
      .select('nome usuario permissoes filiais administrador ativo')
      .sort({ usuario: 1 })
      .lean();
    res.render('permissoes', {
      title: 'Usuários',
      activePage: 'usuario',
      usuarios: usuarios.map((usuario) => ({
        ...usuario,
        filiais: usuario.filiais ?? [1, 3, 4]
      }))
    });
  } catch (error) {
    next(error);
  }
};

exports.salvarPermissoes = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      req.flash('error', 'Usuário não encontrado.');
      return res.redirect('/usuario/permissoes');
    }
    if (usuario.administrador) {
      req.flash('error', 'As permissões do administrador principal não podem ser alteradas.');
      return res.redirect('/usuario/permissoes');
    }

    const permissoesEnviadas = req.body.permissoes || {};
    for (const nome of [
      'estoque',
      'estoqueEditar',
      'estoqueExcluir',
      'suprimentos',
      'suprimentosEditar',
      'suprimentosExcluir',
      'requisicoes',
      'estoqueRequisicoes',
      'transferencias',
      'administracao'
    ]) {
      usuario.permissoes[nome] = permissoesEnviadas[nome] === 'on';
    }
    const filiais = filiaisDoFormulario(req.body.filiais);
    if (!filiais.length) {
      req.flash('error', 'Selecione pelo menos uma filial válida para o usuário.');
      return res.redirect('/usuario/permissoes');
    }
    usuario.filiais = filiais;
    await usuario.save();

    req.flash('success', `Permissões e filiais de ${usuario.nome} atualizadas.`);
    res.redirect('/usuario/permissoes');
  } catch (error) {
    next(error);
  }
};

exports.atualizarAtivo = async (req, res, next) => {
  try {
    const ativo = req.body.ativo;
    if (ativo !== 'true' && ativo !== 'false') {
      req.flash('error', 'Status de usuário inválido.');
      return res.redirect('/usuario/permissoes');
    }

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      req.flash('error', 'Usuário não encontrado.');
      return res.redirect('/usuario/permissoes');
    }
    if (usuario.administrador) {
      req.flash('error', 'A conta do administrador master não pode ser desativada.');
      return res.redirect('/usuario/permissoes');
    }
    if (String(usuario._id) === String(req.usuario._id) && ativo === 'false') {
      req.flash('error', 'Você não pode desativar sua própria conta.');
      return res.redirect('/usuario/permissoes');
    }

    usuario.ativo = ativo === 'true';
    await usuario.save();

    req.flash('success', `Usuário ${usuario.nome} ${usuario.ativo ? 'ativado' : 'desativado'}.`);
    res.redirect('/usuario/permissoes');
  } catch (error) {
    next(error);
  }
};

exports.alterarSenha = async (req, res, next) => {
  try {
    const senha = String(req.body.senha || '');
    if (senha.length < 8 || senha.length > 72) {
      req.flash('error', 'A senha deve ter entre 8 e 72 caracteres.');
      return res.redirect('/usuario/permissoes');
    }

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      req.flash('error', 'Usuário não encontrado.');
      return res.redirect('/usuario/permissoes');
    }
    if (usuario.administrador) {
      req.flash('error', 'A senha do administrador master não pode ser alterada por esta tela.');
      return res.redirect('/usuario/permissoes');
    }

    usuario.senhaHash = await bcrypt.hash(senha, 12);
    await usuario.save();

    req.flash('success', `Senha de ${usuario.nome} alterada.`);
    res.redirect('/usuario/permissoes');
  } catch (error) {
    next(error);
  }
};

exports.gerarCodigoSeguranca = async (req, res, next) => {
  try {
    if (!req.usuario.administrador) {
      return res.status(403).render('error', {
        title: 'Acesso não permitido',
        message: 'Somente o administrador master pode gerar e visualizar códigos de segurança.'
      });
    }

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) {
      req.flash('error', 'Usuário não encontrado.');
      return res.redirect('/usuario/permissoes');
    }
    if (usuario.administrador) {
      req.flash('error', 'O código da conta master não pode ser alterado por esta tela.');
      return res.redirect('/usuario/permissoes');
    }

    const codigoSeguranca = gerarCodigoSeguranca();
    usuario.codigoSegurancaHash = await bcrypt.hash(codigoSeguranca, 12);
    await usuario.save();

    req.flash('success', `Novo código de segurança de ${usuario.nome}: ${codigoSeguranca}`);
    res.redirect('/usuario/permissoes');
  } catch (error) {
    next(error);
  }
};

exports.novo = (req, res) => {
  res.render('novo_usuario', {
    title: 'Novo usuário',
    activePage: 'usuario'
  });
};

exports.criar = async (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const usuario = String(req.body.usuario || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    const nomeValido = nome.length >= 2 && nome.length <= 80;
    const usuarioValido = /^[a-z0-9._-]{3,30}$/.test(usuario);

    if (!nomeValido || !usuarioValido || senha.length < 8 || senha.length > 72) {
      req.flash('error', 'Confira os dados: nome de 2 a 80 caracteres, usuário de 3 a 30 caracteres e senha de 8 a 72 caracteres.');
      return res.redirect('/usuario/novo');
    }

    const permissoesEnviadas = req.body.permissoes || {};
    const filiais = filiaisDoFormulario(req.body.filiais);
    if (!filiais.length) {
      req.flash('error', 'Selecione pelo menos uma filial válida para o usuário.');
      return res.redirect('/usuario/novo');
    }
    const codigoSeguranca = gerarCodigoSeguranca();
    await Usuario.create({
      nome,
      usuario,
      senhaHash: await bcrypt.hash(senha, 12),
      codigoSegurancaHash: await bcrypt.hash(codigoSeguranca, 12),
      filiais,
      permissoes: {
        estoque: permissoesEnviadas.estoque === 'on',
        estoqueEditar: permissoesEnviadas.estoqueEditar === 'on',
        estoqueExcluir: permissoesEnviadas.estoqueExcluir === 'on',
        suprimentos: permissoesEnviadas.suprimentos === 'on',
        suprimentosEditar: permissoesEnviadas.suprimentosEditar === 'on',
        suprimentosExcluir: permissoesEnviadas.suprimentosExcluir === 'on',
        requisicoes: permissoesEnviadas.requisicoes === 'on',
        estoqueRequisicoes: permissoesEnviadas.estoqueRequisicoes === 'on',
        transferencias: permissoesEnviadas.transferencias === 'on',
        administracao: permissoesEnviadas.administracao === 'on'
      }
    });

    req.flash('success', req.usuario.administrador
      ? `Usuário ${nome} criado. Código de segurança: ${codigoSeguranca}`
      : `Usuário ${nome} criado. O código de segurança foi gerado e só pode ser visualizado pelo administrador master.`);
    res.redirect('/usuario/permissoes');
  } catch (error) {
    if (error.code === 11000) {
      req.flash('error', 'Esse nome de usuário já está em uso.');
      return res.redirect('/usuario/novo');
    }
    next(error);
  }
};

exports.exclusaoDados = (req, res) => {
  res.render('excluir_dados', {
    title: 'Excluir dados operacionais',
    activePage: 'usuario'
  });
};

exports.excluirDados = async (req, res, next) => {
  if (req.body.confirmacao !== 'EXCLUIR DADOS') {
    req.flash('error', 'Digite EXCLUIR DADOS para confirmar a operação.');
    return res.redirect('/usuario/dados');
  }

  let sessao;
  try {
    sessao = await mongoose.startSession();
    await sessao.withTransaction(async () => {
      await ItemEstoque.deleteMany({}, { session: sessao });
      await Suprimento.deleteMany({}, { session: sessao });
      await RequisicaoSuprimento.deleteMany({}, { session: sessao });
    });
  } catch (error) {
    next(error);
    return;
  } finally {
    if (sessao) await sessao.endSession();
  }
  req.flash('success', 'Estoque, suprimentos e requisições foram excluídos. Usuários e sessões foram preservados.');
  res.redirect('/usuario/dados');
};
