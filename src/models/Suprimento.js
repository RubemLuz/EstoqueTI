const mongoose = require('mongoose');

// Cadastro e saldo de um material consumível associado a uma filial.
const suprimentoSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true
  },
  filial: {
    type: Number,
    enum: [1, 3, 4],
    default: 4,
    required: true
  },
  impressora: {
    type: String,
    trim: true,
    default: ''
  },
  tipo: {
    type: String,
    trim: true,
    default: ''
  },
  quantidadeAtual: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  quantidadeMinima: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  quantidadePendente: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  ativo: {
    type: Boolean,
    default: true,
    required: true
  }
}, {
  // Mantém as datas de criação e alteração para acompanhamento do registro.
  timestamps: {
    createdAt: 'dataCriacao',
    updatedAt: 'dataUltimaEdicao'
  }
});

module.exports = mongoose.model('Suprimento', suprimentoSchema);
