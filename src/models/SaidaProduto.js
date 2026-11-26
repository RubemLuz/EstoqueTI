const mongoose = require('mongoose');

const itemSaidaSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  nome: {
    type: String,
    required: true,
    trim: true
  },
  modelo: {
    type: String,
    default: ''
  },
  categoria: {
    type: String,
    default: ''
  },
  quantidade: {
    type: Number,
    required: true,
    min: 1
  }
}, { _id: false });

const saidaProdutoSchema = new mongoose.Schema({
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
  usuario: {
    type: String,
    required: true
  },
  itens: {
    type: [itemSaidaSchema],
    required: true,
    validate: {
      validator: (itens) => itens.length > 0,
      message: 'A saída deve conter pelo menos um produto.'
    }
  }
}, {
  collection: 'saidas_produtos'
});

saidaProdutoSchema.index({ filial: 1, data: -1 });

module.exports = mongoose.model('SaidaProduto', saidaProdutoSchema);
