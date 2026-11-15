const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');

exports.index = (req, res) => {
  if (req.session.usuarioId) return res.redirect('/usuario');
  res.render('login', { title: 'Login' });
};

exports.entrar = async (req, res, next) => {
  try {
    const usuario = String(req.body.usuario || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');

    if (!usuario || !senha || senha.length > 72) {
      req.flash('error', 'Usuário ou senha inválidos.');
      return res.redirect('/login');
    }

    const conta = await Usuario.findOne({ usuario })
      .select('+senhaHash');
    if (!conta) {
      req.flash('error', 'Usuário ou senha inválidos.');
      return res.redirect('/login');
    }

    const senhaValida = await bcrypt.compare(senha, conta.senhaHash);
    if (!senhaValida) {
      req.flash('error', 'Usuário ou senha inválidos.');
      return res.redirect('/login');
    }
    if (!conta.ativo) {
      req.flash('error', 'Este usuário está desativado e não pode acessar o sistema.');
      return res.redirect('/login');
    }

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.usuarioId = String(conta._id);
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.redirect('/usuario');
      });
    });
  } catch (error) {
    next(error);
  }
};

exports.esqueciSenha = (req, res) => {
  res.render('esqueci_senha', { title: 'Recuperar senha' });
};

exports.redefinirSenha = async (req, res, next) => {
  try {
    const usuario = String(req.body.usuario || '').trim().toLowerCase();
    const codigoSeguranca = String(req.body.codigoSeguranca || '');
    const novaSenha = String(req.body.novaSenha || '');

    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)
      || !/^\d{5}$/.test(codigoSeguranca)
      || novaSenha.length < 8
      || novaSenha.length > 72) {
      req.flash('error', 'Não foi possível redefinir a senha. Confira os dados e tente novamente.');
      return res.redirect('/esqueci-senha');
    }

    const conta = await Usuario.findOne({ usuario, ativo: true })
      .select('+codigoSegurancaHash');
    if (!conta || !await bcrypt.compare(codigoSeguranca, conta.codigoSegurancaHash)) {
      req.flash('error', 'Não foi possível redefinir a senha. Confira os dados e tente novamente.');
      return res.redirect('/esqueci-senha');
    }

    conta.senhaHash = await bcrypt.hash(novaSenha, 12);
    await conta.save();

    req.flash('success', 'Senha alterada. Entre com sua nova senha.');
    res.redirect('/login');
  } catch (error) {
    next(error);
  }
};

exports.sair = (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};
