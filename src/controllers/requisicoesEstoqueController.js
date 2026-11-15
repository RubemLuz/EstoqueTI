const { randomInt } = require('crypto');
const ItemEstoque = require('../models/ItemEstoque');
const RequisicaoEstoque = require('../models/RequisicaoEstoque');

let operacaoEmAndamento = false;

const filialDoRequest = (req) => Number(req.filial || 1);

const filtroFilial = (filial) => filial === 4
  ? { $or: [{ filial: 4 }, { filial: { $exists: false } }] }
  : { filial };

const gerarId = async () => {
  let id;
  do {
    id = String(randomInt(10000, 100000));
  } while (await RequisicaoEstoque.exists({ id }));
  return id;
};

const redirecionarComMensagem = (req, res, filial, id, tipo, mensagem) => {
  req.flash(tipo, mensagem);
  res.redirect(`/requisicoes-estoque?filial=${filial}&abrir=${encodeURIComponent(id)}`);
};

const criarMovimentos = (itens, quantidadesRecebidas) => {
  const movimentosPorId = new Map();
  const recebimento = quantidadesRecebidas !== undefined;

  itens.forEach((item, index) => {
    const quantidadeSolicitada = Number(item.quantidade);
    const valorRecebido = quantidadesRecebidas?.[index];
    const quantidadeRecebida = recebimento ? Number(valorRecebido) : 0;
    if (!Number.isInteger(quantidadeSolicitada) || quantidadeSolicitada < 1
      || (recebimento && (valorRecebido === undefined || valorRecebido === null
        || String(valorRecebido).trim() === '' || !Number.isInteger(quantidadeRecebida)
        || quantidadeRecebida < 0))) {
      const error = new Error('Informe quantidades recebidas válidas (números inteiros iguais ou maiores que zero).');
      error.status = 400;
      throw error;
    }

    const id = String(item.id);
    const movimento = movimentosPorId.get(id) || {
      id,
      quantidadePendente: 0,
      quantidadeAtual: 0
    };
    movimento.quantidadePendente += quantidadeSolicitada;
    movimento.quantidadeAtual += quantidadeRecebida;
    movimentosPorId.set(id, movimento);
  });

  return [...movimentosPorId.values()];
};

const reverterReservas = async (movimentos, filial) => {
  for (const movimento of [...movimentos].reverse()) {
    const resultado = await ItemEstoque.updateOne(
      { _id: movimento.id, ...filtroFilial(filial) },
      { $inc: { quantidadePendente: -movimento.quantidadePendente } }
    );
    if (resultado.matchedCount !== 1) {
      throw new Error(`Não foi possível reverter a reserva do produto ${movimento.id}.`);
    }
  }
};

const reservarMovimentos = async (movimentos, filial) => {
  const reservados = [];
  try {
    for (const movimento of movimentos) {
      const resultado = await ItemEstoque.updateOne(
        {
          _id: movimento.id,
          ...filtroFilial(filial),
          ativo: { $ne: false }
        },
        { $inc: { quantidadePendente: movimento.quantidadePendente } }
      );
      if (resultado.matchedCount !== 1) {
        const error = new Error('Um produto não está mais ativo nesta filial; não foi possível criar a requisição.');
        error.status = 409;
        throw error;
      }
      reservados.push(movimento);
    }
    return reservados;
  } catch (error) {
    await reverterReservas(reservados, filial);
    throw error;
  }
};

const reverterMovimentos = async (movimentos, filial) => {
  for (const movimento of [...movimentos].reverse()) {
    const resultado = await ItemEstoque.updateOne(
      { _id: movimento.id, ...filtroFilial(filial) },
      {
        $inc: {
          quantidadePendente: movimento.quantidadePendente,
          quantidadeAtual: -movimento.quantidadeAtual
        }
      }
    );
    if (resultado.matchedCount !== 1) {
      throw new Error(`Não foi possível reverter a atualização do produto ${movimento.id}.`);
    }
  }
};

const aplicarMovimentos = async (movimentos, filial) => {
  const aplicados = [];
  try {
    for (const movimento of movimentos) {
      const resultado = await ItemEstoque.updateOne(
        {
          _id: movimento.id,
          ...filtroFilial(filial),
          quantidadePendente: { $gte: movimento.quantidadePendente }
        },
        {
          $inc: {
            quantidadePendente: -movimento.quantidadePendente,
            quantidadeAtual: movimento.quantidadeAtual
          }
        }
      );
      if (resultado.matchedCount !== 1) {
        const produto = await ItemEstoque.findOne({
          _id: movimento.id,
          ...filtroFilial(filial)
        }).select('nome quantidadePendente');
        const error = new Error(produto
          ? `Quantidade pendente insuficiente para ${produto.nome}.`
          : `O produto ${movimento.id} não foi encontrado nesta filial.`);
        error.status = 409;
        throw error;
      }
      aplicados.push(movimento);
    }
    return aplicados;
  } catch (error) {
    try {
      await reverterMovimentos(aplicados, filial);
    } catch (rollbackError) {
      throw new Error(`${error.message} A reversão dos ajustes anteriores também falhou: ${rollbackError.message}`);
    }
    throw error;
  }
};

exports.index = async (req, res, next) => {
  try {
    const filial = filialDoRequest(req);
    const filtro = filtroFilial(filial);
    const [produtos, requisicoes] = await Promise.all([
      ItemEstoque.find({ ativo: { $ne: false }, ...filtro }).sort({ nome: 1 }),
      RequisicaoEstoque.find({ filial }).sort({ data: -1 }).lean()
    ]);
    res.render('requisicoes_estoque', {
      title: 'Requisições de estoque',
      activePage: 'reqestoque',
      produtos,
      filial,
      requisicoes
    });
  } catch (error) {
    next(error);
  }
};

exports.criar = async (req, res, next) => {
  if (operacaoEmAndamento) {
    return res.status(409).send('Já existe uma atualização de requisição em andamento. Tente novamente.');
  }
  operacaoEmAndamento = true;
  let movimentosReservados = [];
  const filial = filialDoRequest(req);

  try {
    let itens;
    try {
      itens = JSON.parse(req.body.itens || '[]');
    } catch {
      return res.status(400).send('Lista de produtos inválida.');
    }
    if (!Array.isArray(itens) || !itens.length) {
      return res.status(400).send('Adicione pelo menos um produto.');
    }

    const produtos = await ItemEstoque.find({
      _id: { $in: itens.map((item) => item.id) },
      ativo: { $ne: false },
      ...filtroFilial(filial)
    });
    const produtosPorId = new Map(produtos.map((produto) => [String(produto._id), produto]));
    const itensNormalizados = [];
    for (const item of itens) {
      const produto = produtosPorId.get(String(item.id));
      const quantidade = Number(item.quantidade);
      if (!produto || !Number.isInteger(quantidade) || quantidade < 1) {
        return res.status(400).send('Existem produtos ou quantidades inválidos na requisição.');
      }
      itensNormalizados.push({
        id: String(produto._id),
        nome: produto.nome,
        modelo: produto.modelo || '',
        informacaoExtra: produto.informacaoExtra || '',
        categoria: produto.categoria || '',
        quantidade
      });
    }

    const id = await gerarId();
    movimentosReservados = await reservarMovimentos(criarMovimentos(itensNormalizados), filial);
    await RequisicaoEstoque.create({
      id,
      filial,
      data: new Date(),
      status: 'Pendente',
      itens: itensNormalizados
    });
    movimentosReservados = [];

    const conteudo = [
      'REQUISIÇÃO DE PRODUTOS DE ESTOQUE',
      `Número: ${id}`,
      `Data: ${new Date().toLocaleDateString('pt-BR')}`,
      `Filial: ${filial}`,
      '',
      ...itensNormalizados.map((item) =>
        `${item.nome}, ${item.modelo || '-'}, ${item.informacaoExtra || '-'}, ${item.quantidade}`
      )
    ].join('\n');

    req.flash('success', `Requisição ${id} criada com sucesso.`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="requisicao-estoque-${id}.txt"`);
    res.setHeader('X-Requisicao-Id', id);
    res.send(`\uFEFF${conteudo}`);
  } catch (error) {
    if (movimentosReservados.length) {
      try {
        await reverterReservas(movimentosReservados, filial);
      } catch (rollbackError) {
        return next(new Error(`${error.message} A reversão das reservas também falhou: ${rollbackError.message}`));
      }
    }
    if (error.status === 400 || error.status === 409) {
      return res.status(error.status).send(error.message);
    }
    next(error);
  } finally {
    operacaoEmAndamento = false;
  }
};

exports.receber = async (req, res, next) => {
  if (operacaoEmAndamento) {
    return res.status(409).send('Já existe uma atualização de requisição em andamento. Tente novamente.');
  }
  operacaoEmAndamento = true;
  const filial = filialDoRequest(req);
  const id = String(req.params.id);
  let movimentosAplicados = [];

  try {
    const requisicao = await RequisicaoEstoque.findOne({ id, filial });
    if (!requisicao) {
      return redirecionarComMensagem(req, res, filial, id, 'error', 'Requisição não encontrada nesta filial.');
    }
    if (requisicao.status !== 'Pendente') {
      return redirecionarComMensagem(req, res, filial, id, 'error', 'Esta requisição já foi recebida.');
    }

    let movimentos;
    try {
      movimentos = criarMovimentos(requisicao.itens, req.body.quantidades);
    } catch (error) {
      return redirecionarComMensagem(req, res, filial, id, 'error', error.message);
    }

    movimentosAplicados = await aplicarMovimentos(movimentos, filial);
    requisicao.itens.forEach((item, index) => {
      item.quantidadeRecebida = Number(req.body.quantidades[index]);
    });
    requisicao.status = 'Recebido';
    requisicao.dataRecebimento = new Date();
    await requisicao.save();
    movimentosAplicados = [];

    req.flash('success', `Requisição ${id} recebida e estoque atualizado.`);
    res.redirect(`/requisicoes-estoque?filial=${filial}`);
  } catch (error) {
    if (movimentosAplicados.length) {
      try {
        await reverterMovimentos(movimentosAplicados, filial);
      } catch (rollbackError) {
        return next(new Error(`${error.message} A reversão dos ajustes de estoque também falhou: ${rollbackError.message}`));
      }
    }
    if (error.status === 400 || error.status === 409) {
      return redirecionarComMensagem(req, res, filial, id, 'error', error.message);
    }
    next(error);
  } finally {
    operacaoEmAndamento = false;
  }
};

exports.excluir = async (req, res, next) => {
  if (operacaoEmAndamento) {
    return res.status(409).send('Já existe uma atualização de requisição em andamento. Tente novamente.');
  }
  operacaoEmAndamento = true;
  const filial = filialDoRequest(req);
  const id = String(req.params.id);
  let movimentosAplicados = [];

  try {
    const requisicao = await RequisicaoEstoque.findOne({ id, filial });
    if (!requisicao) {
      return redirecionarComMensagem(req, res, filial, id, 'error', 'Requisição não encontrada nesta filial.');
    }

    const movimentos = requisicao.status === 'Pendente'
      ? criarMovimentos(requisicao.itens)
      : [];
    if (movimentos.length) {
      movimentosAplicados = await aplicarMovimentos(
        movimentos.map((movimento) => ({ ...movimento, quantidadeAtual: 0 })),
        filial
      );
    }
    const resultado = await RequisicaoEstoque.deleteOne({ id, filial });
    if (resultado.deletedCount !== 1) {
      const error = new Error('A requisição não foi excluída do banco de dados.');
      error.status = 409;
      throw error;
    }
    movimentosAplicados = [];

    req.flash('success', `Requisição ${id} excluída.`);
    res.redirect(`/requisicoes-estoque?filial=${filial}`);
  } catch (error) {
    if (movimentosAplicados.length) {
      try {
        await reverterMovimentos(movimentosAplicados, filial);
      } catch (rollbackError) {
        return next(new Error(`${error.message} A reversão dos ajustes também falhou: ${rollbackError.message}`));
      }
    }
    if (error.status === 409) {
      return redirecionarComMensagem(req, res, filial, id, 'error', error.message);
    }
    next(error);
  } finally {
    operacaoEmAndamento = false;
  }
};
