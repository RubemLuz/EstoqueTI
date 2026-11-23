const mongoose = require('mongoose');

const itemTransferenciaSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  tipoItem: {
    type: String,
    enum: ['produto', 'suprimento'],
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
  informacaoExtra: {
    type: String,
    default: ''
  },
  categoria: {
    type: String,
    default: ''
  },
  impressora: {
    type: String,
    default: ''
  },
  tipoSuprimento: {
    type: String,
    default: ''
  },
  quantidade: {
    type: Number,
    required: true,
    min: 1
  }
}, { _id: false });

const transferenciaSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  filialOrigem: {
    type: Number,
    enum: [1, 3, 4],
    required: true,
    index: true
  },
  filialDestino: {
    type: Number,
    enum: [1, 3, 4],
    required: true,
    index: true
  },
  modalidade: {
    type: String,
    enum: ['envio', 'requisicao'],
    default: 'envio',
    required: true
  },
  usuario: {
    type: String,
    required: true
  },
  data: {
    type: Date,
    required: true,
    default: Date.now
  },
  dataEnvio: Date,
  dataRecebimento: Date,
  dataRejeicao: Date,
  observacaoRejeicao: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  status: {
    type: String,
    enum: ['Solicitado', 'Enviado', 'Recebido', 'Rejeitado'],
    required: true,
    default: 'Solicitado'
  },
  itens: {
    type: [itemTransferenciaSchema],
    required: true,
    validate: {
      validator: (itens) => itens.length > 0,
      message: 'A transferência deve conter pelo menos um item.'
    }
  }
}, {
  collection: 'transferencias'
});

transferenciaSchema.index({ filialOrigem: 1, data: -1 });
transferenciaSchema.index({ filialDestino: 1, data: -1 });

module.exports = mongoose.model('Transferencia', transferenciaSchema);
