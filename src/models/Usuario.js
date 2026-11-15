const mongoose = require('mongoose');

const permissoesSchema = new mongoose.Schema({
  estoque: { type: Boolean, default: false },
  estoqueEditar: { type: Boolean, default: undefined },
  estoqueExcluir: { type: Boolean, default: undefined },
  suprimentos: { type: Boolean, default: false },
  suprimentosEditar: { type: Boolean, default: undefined },
  suprimentosExcluir: { type: Boolean, default: undefined },
  requisicoes: { type: Boolean, default: false },
  administracao: { type: Boolean, default: false }
}, { _id: false });

const usuarioSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },
  usuario: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-z0-9._-]+$/
  },
  senhaHash: {
    type: String,
    required: true,
    select: false
  },
  codigoSegurancaHash: {
    type: String,
    required: true,
    select: false
  },
  permissoes: {
    type: permissoesSchema,
    default: () => ({})
  },
  filiais: {
    type: [{
      type: Number,
      enum: [1, 3, 4]
    }],
    default: () => [1, 3, 4],
    validate: {
      validator: (filiais) => filiais.length > 0,
      message: 'O usuário precisa ter acesso a pelo menos uma filial.'
    }
  },
  administrador: {
    type: Boolean,
    default: false,
    required: true
  },
  ativo: {
    type: Boolean,
    default: true,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Usuario', usuarioSchema);
