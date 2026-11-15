const mongoose = require('mongoose');

const itemRequisicaoSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  nome: {
    type: String,
    required: true,
    trim: true
  },
  impressora: {
    type: String,
    default: ''
  },
  tipo: {
    type: String,
    default: ''
  },
  quantidade: {
    type: Number,
    required: true,
    min: 1
  },
  quantidadeRecebida: {
    type: Number,
    min: 0
  }
}, { _id: false });

const requisicaoSuprimentoSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  filial: {
    type: Number,
    enum: [1, 3, 4],
    required: true,
    index: true
  },
  data: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Pendente', 'Recebido'],
    required: true,
    default: 'Pendente'
  },
  itens: {
    type: [itemRequisicaoSchema],
    required: true,
    validate: {
      validator: (itens) => itens.length > 0,
      message: 'A requisição deve conter pelo menos um suprimento.'
    }
  },
  dataRecebimento: {
    type: Date
  }
}, {
  collection: 'requisicoes_suprimentos'
});

requisicaoSuprimentoSchema.index({ filial: 1, data: -1 });

module.exports = mongoose.model('RequisicaoSuprimento', requisicaoSuprimentoSchema);
