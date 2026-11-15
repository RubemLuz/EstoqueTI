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
    const codigoSeguranca = String(req.body.codigoSeguranca || '');

    if (!usuario || !senha || !codigoSeguranca || senha.length > 72 || codigoSeguranca.length > 32) {
      req.flash('error', 'Usuário, senha ou código de segurança inválidos.');
      return res.redirect('/login');
    }

    const conta = await Usuario.findOne({ usuario, ativo: true })
      .select('+senhaHash +codigoSegurancaHash');
    if (!conta) {
      req.flash('error', 'Usuário, senha ou código de segurança inválidos.');
      return res.redirect('/login');
    }

    const [senhaValida, codigoValido] = await Promise.all([
      bcrypt.compare(senha, conta.senhaHash),
      bcrypt.compare(codigoSeguranca, conta.codigoSegurancaHash)
    ]);
    if (!senhaValida || !codigoValido) {
      req.flash('error', 'Usuário, senha ou código de segurança inválidos.');
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

exports.sair = (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};
