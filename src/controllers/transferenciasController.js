const { randomInt } = require('crypto');
const mongoose = require('mongoose');
const ItemEstoque = require('../models/ItemEstoque');
const Suprimento = require('../models/Suprimento');
const Transferencia = require('../models/Transferencia');

let operacaoEmAndamento = false;

const filialDoRequest = (req) => Number(req.filial || 1);
const modeloPorTipo = (tipoItem) => tipoItem === 'produto' ? ItemEstoque : Suprimento;
const ehRequisicao = (transferencia) => transferencia.modalidade === 'requisicao';
const filtroFilial = (tipoItem, filial) => tipoItem === 'produto' && filial === 4
  ? { $or: [{ filial: 4 }, { filial: { $exists: false } }] }
  : { filial };

const gerarId = async () => {
  let id;
  do {
    id = String(randomInt(10000, 100000));
  } while (await Transferencia.exists({ id }));
  return id;
};

const redirecionarComMensagem = (req, res, filial, tipo, mensagem, id) => {
  req.flash(tipo, mensagem);
  const destino = id ? `&abrir=${encodeURIComponent(id)}` : '';
  res.redirect(`/transferencias?filial=${filial}${destino}`);
};

const lerItens = (valor) => {
  let itens;
  try {
    itens = JSON.parse(valor || '[]');
  } catch {
    const error = new Error('A lista de itens da transferência está inválida.');
    error.status = 400;
    throw error;
  }

  if (!Array.isArray(itens) || !itens.length) {
    const error = new Error('Adicione pelo menos um item à transferência.');
    error.status = 400;
    throw error;
  }

  const itensPorChave = new Map();
  for (const item of itens) {
    const tipoItem = String(item?.tipoItem || '');
    const id = String(item?.id || '');
    const quantidade = Number(item?.quantidade);
    if (!['produto', 'suprimento'].includes(tipoItem) || !id
      || !mongoose.isValidObjectId(id) || !Number.isInteger(quantidade) || quantidade < 1) {
      const error = new Error('Existem itens ou quantidades inválidos na transferência.');
      error.status = 400;
      throw error;
    }
    const chave = `${tipoItem}:${id}`;
    const itemExistente = itensPorChave.get(chave);
    itensPorChave.set(chave, {
      tipoItem,
      id,
      quantidade: quantidade + (itemExistente?.quantidade || 0)
    });
  }
  return [...itensPorChave.values()];
};

const prepararItens = async (itens, filial) => {
  const normalizados = [];
  for (const tipoItem of ['produto', 'suprimento']) {
    const itensDoTipo = itens.filter((item) => item.tipoItem === tipoItem);
    if (!itensDoTipo.length) continue;

    const Model = modeloPorTipo(tipoItem);
    const registros = await Model.find({
      _id: { $in: itensDoTipo.map((item) => item.id) },
      ativo: { $ne: false },
      ...filtroFilial(tipoItem, filial)
    });
    const registrosPorId = new Map(registros.map((registro) => [String(registro._id), registro]));

    for (const item of itensDoTipo) {
      const registro = registrosPorId.get(item.id);
      if (!registro) {
        const error = new Error(`Um ${tipoItem} selecionado não está ativo ou não pertence a esta filial.`);
        error.status = 409;
        throw error;
      }
      const saldoDisponivel = registro.quantidadeAtual - (registro.quantidadePendente || 0);
      if (item.quantidade > saldoDisponivel) {
        const error = new Error(
          `Saldo disponível insuficiente para ${registro.nome}. Disponível: ${Math.max(0, Math.floor(saldoDisponivel))}.`
        );
        error.status = 409;
        throw error;
      }
      normalizados.push({
        id: item.id,
        tipoItem,
        nome: registro.nome,
        ...(tipoItem === 'produto'
          ? {
            modelo: registro.modelo || '',
            informacaoExtra: registro.informacaoExtra || '',
            categoria: registro.categoria || ''
          }
          : {
            impressora: registro.impressora || '',
            tipoSuprimento: registro.tipo || ''
          }),
        quantidade: item.quantidade
      });
    }
  }
  return normalizados;
};

const reverterBaixas = async (itens, filial) => {
  for (const item of [...itens].reverse()) {
    const resultado = await modeloPorTipo(item.tipoItem).updateOne(
      { _id: item.id, ...filtroFilial(item.tipoItem, filial) },
      { $inc: { quantidadeAtual: item.quantidade } }
    );
    if (resultado.matchedCount !== 1) {
      throw new Error(`Não foi possível reverter a baixa de ${item.nome}.`);
    }
  }
};

const baixarItens = async (itens, filial) => {
  const baixados = [];
  try {
    for (const item of itens) {
      const Model = modeloPorTipo(item.tipoItem);
      const resultado = await Model.updateOne(
        {
          _id: item.id,
          ...filtroFilial(item.tipoItem, filial),
          ativo: { $ne: false },
          quantidadeAtual: { $gte: item.quantidade },
          $expr: {
            $gte: [
              { $subtract: ['$quantidadeAtual', { $ifNull: ['$quantidadePendente', 0] }] },
              item.quantidade
            ]
          }
        },
        { $inc: { quantidadeAtual: -item.quantidade } }
      );
      if (resultado.matchedCount !== 1) {
        const registro = await Model.findOne({
          _id: item.id,
          ...filtroFilial(item.tipoItem, filial)
        }).select('nome quantidadeAtual quantidadePendente ativo');
        const error = new Error(!registro || registro.ativo === false
          ? `${item.nome} não está mais ativo nesta filial.`
          : `Saldo disponível insuficiente para ${item.nome}.`);
        error.status = 409;
        throw error;
      }
      baixados.push(item);
    }
    return baixados;
  } catch (error) {
    try {
      await reverterBaixas(baixados, filial);
    } catch (rollbackError) {
      throw new Error(`${error.message} A reversão das baixas também falhou: ${rollbackError.message}`);
    }
    throw error;
  }
};

const filtroDestinoPorItem = (item) => item.tipoItem === 'produto'
  ? {
    nome: item.nome,
    modelo: item.modelo || '',
    informacaoExtra: item.informacaoExtra || '',
    categoria: item.categoria || ''
  }
  : {
    nome: item.nome,
    impressora: item.impressora || '',
    tipo: item.tipoSuprimento || ''
  };

const reverterRecebimentos = async (movimentos, filial) => {
  for (const movimento of [...movimentos].reverse()) {
    const Model = modeloPorTipo(movimento.tipoItem);
    const resultado = movimento.criado
      ? await Model.deleteOne({
        _id: movimento.id,
        ...filtroFilial(movimento.tipoItem, filial)
      })
      : await Model.updateOne(
        {
          _id: movimento.id,
          ...filtroFilial(movimento.tipoItem, filial)
        },
        { $inc: { quantidadeAtual: -movimento.quantidade } }
      );
    const alteracoes = movimento.criado ? resultado.deletedCount : resultado.matchedCount;
    if (alteracoes !== 1) {
      throw new Error(`Não foi possível reverter o recebimento de ${movimento.nome}.`);
    }
  }
};

const receberItens = async (itens, filial) => {
  const movimentos = [];
  try {
    for (const item of itens) {
      const Model = modeloPorTipo(item.tipoItem);
      const filtroFilialDestino = filtroFilial(item.tipoItem, filial);
      const existente = await Model.findOne({
        ...filtroFilialDestino,
        ativo: { $ne: false },
        ...filtroDestinoPorItem(item)
      }).sort({ _id: 1 });

      if (existente) {
        const resultado = await Model.updateOne(
          { _id: existente._id, ...filtroFilialDestino },
          { $inc: { quantidadeAtual: item.quantidade } }
        );
        if (resultado.matchedCount !== 1) {
          throw new Error(`Não foi possível atualizar o saldo de ${item.nome} na filial ${filial}.`);
        }
        movimentos.push({
          tipoItem: item.tipoItem,
          id: String(existente._id),
          nome: item.nome,
          quantidade: item.quantidade
        });
      } else {
        const novoRegistro = await Model.create({
          ...filtroDestinoPorItem(item),
          filial,
          quantidadeAtual: item.quantidade,
          quantidadeMinima: 0,
          quantidadePendente: 0,
          ativo: true
        });
        movimentos.push({
          tipoItem: item.tipoItem,
          id: String(novoRegistro._id),
          nome: item.nome,
          quantidade: item.quantidade,
          criado: true
        });
      }
    }
    return movimentos;
  } catch (error) {
    try {
      await reverterRecebimentos(movimentos, filial);
    } catch (rollbackError) {
      throw new Error(`${error.message} A reversão dos recebimentos também falhou: ${rollbackError.message}`);
    }
    throw error;
  }
};

exports.index = async (req, res, next) => {
  try {
    const filial = filialDoRequest(req);
    const [produtos, suprimentos, transferencias] = await Promise.all([
      ItemEstoque.find({
        ativo: { $ne: false },
        $or: [{ filial: { $in: [1, 3, 4] } }, { filial: { $exists: false } }]
      }).sort({ nome: 1 }).lean(),
      Suprimento.find({
        ativo: { $ne: false },
        filial: { $in: [1, 3, 4] }
      }).sort({ nome: 1 }).lean(),
      Transferencia.find({
        $or: [{ filialOrigem: filial }, { filialDestino: filial }]
      }).sort({ data: -1 }).lean()
    ]);

    const produtosDisponiveis = produtos
      .map((produto) => ({ ...produto, filialEstoque: Number(produto.filial || 4) }))
      .filter((produto) =>
        Math.floor(produto.quantidadeAtual - (produto.quantidadePendente || 0)) > 0
      );
    const suprimentosDisponiveis = suprimentos
      .map((suprimento) => ({ ...suprimento, filialEstoque: suprimento.filial }))
      .filter((suprimento) =>
        Math.floor(suprimento.quantidadeAtual - (suprimento.quantidadePendente || 0)) > 0
      );

    res.render('transferencias', {
      title: 'Transferências',
      activePage: 'transferencias',
      filial,
      produtosDisponiveis,
      suprimentosDisponiveis,
      transferenciasEnviadas: transferencias.filter((item) => item.filialOrigem === filial),
      transferenciasRecebidas: transferencias.filter((item) => item.filialDestino === filial)
    });
  } catch (error) {
    next(error);
  }
};

exports.criar = async (req, res, next) => {
  const filial = filialDoRequest(req);
  try {
    const modalidade = String(req.body.modalidade || '');
    const filialDestino = Number(req.body.filialDestino);
    if (!['envio', 'requisicao'].includes(modalidade)
      || ![1, 3, 4].includes(filialDestino) || filialDestino === filial) {
      return redirecionarComMensagem(
        req,
        res,
        filial,
        'error',
        'Selecione o tipo de movimentação e uma filial diferente da filial atual.'
      );
    }

    let itens;
    try {
      const filialDoEstoque = modalidade === 'requisicao' ? filialDestino : filial;
      itens = await prepararItens(lerItens(req.body.itens), filialDoEstoque);
    } catch (error) {
      if (error.status === 400 || error.status === 409) {
        return redirecionarComMensagem(req, res, filial, 'error', error.message);
      }
      throw error;
    }
    const id = await gerarId();
    await Transferencia.create({
      id,
      filialOrigem: filial,
      filialDestino,
      modalidade,
      usuario: req.usuario.nome,
      data: new Date(),
      status: 'Solicitado',
      itens
    });
    const mensagem = modalidade === 'requisicao'
      ? `Solicitação ${id} enviada para a Filial ${filialDestino}.`
      : `Transferência ${id} criada.`;
    redirecionarComMensagem(req, res, filial, 'success', mensagem, id);
  } catch (error) {
    next(error);
  }
};

const processarEnvio = async (req, res, next, filtro, mensagem) => {
  if (operacaoEmAndamento) {
    return res.status(409).send('Já existe uma atualização de transferência em andamento. Tente novamente.');
  }
  operacaoEmAndamento = true;
  const filial = filialDoRequest(req);
  const id = String(req.params.id);
  let transferencia;
  try {
    transferencia = await Transferencia.findOneAndUpdate(
      { ...filtro, status: 'Solicitado' },
      { $set: { status: 'Enviado', dataEnvio: new Date() } },
      { new: true }
    );
    if (!transferencia) {
      return redirecionarComMensagem(req, res, filial, 'error', 'Transferência não encontrada ou não está aguardando envio.', id);
    }

    await baixarItens(transferencia.itens, filial);
    redirecionarComMensagem(req, res, filial, 'success', mensagem, id);
  } catch (error) {
    if (transferencia) {
      try {
        const resultado = await Transferencia.updateOne(
          { _id: transferencia._id, status: 'Enviado' },
          { $set: { status: 'Solicitado' }, $unset: { dataEnvio: 1 } }
        );
        if (resultado.matchedCount !== 1) {
          throw new Error('O status da transferência mudou durante a reversão.');
        }
      } catch (rollbackError) {
        return next(new Error(`${error.message} Não foi possível reverter o status da transferência: ${rollbackError.message}`));
      }
    }
    if (error.status === 409) {
      return redirecionarComMensagem(req, res, filial, 'error', error.message, id);
    }
    next(error);
  } finally {
    operacaoEmAndamento = false;
  }
};

exports.enviar = (req, res, next) => {
  const filial = filialDoRequest(req);
  return processarEnvio(
    req,
    res,
    next,
    {
      id: String(req.params.id),
      filialOrigem: filial,
      $or: [{ modalidade: 'envio' }, { modalidade: { $exists: false } }]
    },
    `Transferência ${req.params.id} enviada.`
  );
};

exports.atender = (req, res, next) => {
  const filial = filialDoRequest(req);
  return processarEnvio(
    req,
    res,
    next,
    {
      id: String(req.params.id),
      filialDestino: filial,
      modalidade: 'requisicao'
    },
    `Solicitação ${req.params.id} atendida e enviada.`
  );
};

exports.rejeitar = async (req, res, next) => {
  if (operacaoEmAndamento) {
    return res.status(409).send('Já existe uma atualização de transferência em andamento. Tente novamente.');
  }
  operacaoEmAndamento = true;
  const filial = filialDoRequest(req);
  const id = String(req.params.id);
  const observacao = typeof req.body.observacao === 'string'
    ? req.body.observacao.trim()
    : '';

  try {
    if (!observacao || observacao.length > 500) {
      return redirecionarComMensagem(
        req,
        res,
        filial,
        'error',
        'Informe o motivo da rejeição (máximo de 500 caracteres).',
        id
      );
    }

    const transferencia = await Transferencia.findOneAndUpdate(
      {
        id,
        filialDestino: filial,
        modalidade: 'requisicao',
        status: 'Solicitado'
      },
      {
        $set: {
          status: 'Rejeitado',
          observacaoRejeicao: observacao,
          dataRejeicao: new Date()
        }
      },
      { new: true }
    );
    if (!transferencia) {
      return redirecionarComMensagem(
        req,
        res,
        filial,
        'error',
        'Solicitação não encontrada ou já processada.',
        id
      );
    }
    redirecionarComMensagem(req, res, filial, 'success', `Solicitação ${id} rejeitada.`, id);
  } catch (error) {
    next(error);
  } finally {
    operacaoEmAndamento = false;
  }
};

exports.receber = async (req, res, next) => {
  if (operacaoEmAndamento) {
    return res.status(409).send('Já existe uma atualização de transferência em andamento. Tente novamente.');
  }
  operacaoEmAndamento = true;
  const filial = filialDoRequest(req);
  const id = String(req.params.id);
  let transferencia;
  try {
    transferencia = await Transferencia.findOneAndUpdate(
      {
        id,
        status: 'Enviado',
        $or: [
          { modalidade: 'envio', filialDestino: filial },
          { modalidade: 'requisicao', filialOrigem: filial },
          { modalidade: { $exists: false }, filialDestino: filial }
        ]
      },
      { $set: { status: 'Recebido', dataRecebimento: new Date() } },
      { new: true }
    );
    if (!transferencia) {
      return redirecionarComMensagem(req, res, filial, 'error', 'Transferência não encontrada ou ainda não enviada.', id);
    }

    await receberItens(transferencia.itens, filial);
    redirecionarComMensagem(req, res, filial, 'success', `Recebimento da transferência ${id} confirmado.`);
  } catch (error) {
    if (transferencia) {
      try {
        const resultado = await Transferencia.updateOne(
          { _id: transferencia._id, status: 'Recebido' },
          { $set: { status: 'Enviado' }, $unset: { dataRecebimento: 1 } }
        );
        if (resultado.matchedCount !== 1) {
          throw new Error('O status da transferência mudou durante a reversão.');
        }
      } catch (rollbackError) {
        return next(new Error(`${error.message} Não foi possível reverter o status da transferência: ${rollbackError.message}`));
      }
    }
    next(error);
  } finally {
    operacaoEmAndamento = false;
  }
};
