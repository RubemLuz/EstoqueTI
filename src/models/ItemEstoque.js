const mongoose = require('mongoose');

const itemEstoqueSchema = new mongoose.Schema({
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
  modelo: {
    type: String,
    trim: true,
    default: ''
  },
  informacaoExtra: {
    type: String,
    trim: true,
    default: ''
  },
  categoria: {
    type: String,
    trim: true,
    default: ''
  },
  quantidadeAtual: {
    type: Number,
    required: true,
    min: 0
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
  observacao: {
    type: String,
    trim: true,
    default: ''
  },
  ativo: {
    type: Boolean,
    default: true,
    required: true
  }
}, {
  timestamps: {
    createdAt: 'dataCriacao',
    updatedAt: 'dataUltimaEdicao'
  }
});

module.exports = mongoose.model('ItemEstoque', itemEstoqueSchema);
