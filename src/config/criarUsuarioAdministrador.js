const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');

const criarUsuarioAdministrador = async () => {
  await Usuario.init();
  if (await Usuario.exists({})) return false;

  const nome = process.env.ADMIN_NOME;
  const usuario = process.env.ADMIN_USUARIO;
  const senha = process.env.ADMIN_SENHA;
  const codigoSeguranca = process.env.ADMIN_CODIGO_SEGURANCA;

  if (![nome, usuario, senha, codigoSeguranca].every(Boolean)) {
    throw new Error('Configure ADMIN_NOME, ADMIN_USUARIO, ADMIN_SENHA e ADMIN_CODIGO_SEGURANCA para criar o primeiro administrador.');
  }

  try {
    await Usuario.create({
      nome,
      usuario: usuario.toLowerCase(),
      senhaHash: await bcrypt.hash(senha, 12),
      codigoSegurancaHash: await bcrypt.hash(codigoSeguranca, 12),
      administrador: true,
      filiais: [1, 3, 4],
      permissoes: {
        estoque: true,
        estoqueEditar: true,
        estoqueExcluir: true,
        suprimentos: true,
        suprimentosEditar: true,
        suprimentosExcluir: true,
        requisicoes: true,
        administracao: true
      }
    });
    return true;
  } catch (error) {
    if (error.code === 11000 && await Usuario.exists({})) return false;
    throw error;
  }
};

module.exports = criarUsuarioAdministrador;
