const Suprimento = require('../models/Suprimento');
const RequisicaoSuprimento = require('../models/RequisicaoSuprimento');

// Evita que duas operações de estoque sejam executadas ao mesmo tempo neste processo Node.
let operacaoEmAndamento = false;

// Aceita apenas filiais válidas e usa a filial 4 quando o valor não foi informado ou é inválido.
const filialDoRequest = (req) => {
  const filial = Number(req.query?.filial || req.body?.filial || 1);
  return [1, 3, 4].includes(filial) ? filial : 1;
};

// Gera um identificador numérico de cinco dígitos que ainda não esteja cadastrado.
const gerarId = async () => {
  let id;
  do {
    id = String(Math.floor(10000 + Math.random() * 90000));
  } while (await RequisicaoSuprimento.exists({ id }));
  return id;
};

// Registra uma mensagem temporária e retorna à lista reabrindo a requisição que gerou o erro.
const redirecionarComMensagem = (req, res, filial, id, tipo, mensagem) => {
  req.flash(tipo, mensagem);
  res.redirect(`/requisicoes-suprimentos?filial=${filial}&abrir=${encodeURIComponent(id)}`);
};

// Consolida itens repetidos do mesmo suprimento e calcula quanto liberar do pendente
// e quanto adicionar ao estoque. No recebimento, a quantidade pendente liberada é
// sempre a quantidade originalmente solicitada; a quantidadeAtual é a recebida.
const criarMovimentos = (itens, quantidadesRecebidas) => {
  const movimentosPorId = new Map();
  const recebimento = quantidadesRecebidas !== undefined;
  itens.forEach((item, index) => {
    const quantidadeSolicitada = Number(item.quantidade);
    const valorRecebido = quantidadesRecebidas?.[index];
    const quantidadeRecebida = recebimento
      ? Number(valorRecebido)
      : 0;
    if (!Number.isInteger(quantidadeSolicitada) || quantidadeSolicitada < 1
      || (recebimento
        && (valorRecebido === undefined || valorRecebido === null || String(valorRecebido).trim() === ''
          || !Number.isInteger(quantidadeRecebida) || quantidadeRecebida < 0))) {
      const error = new Error('Informe quantidades recebidas válidas (números inteiros iguais ou maiores que zero).');
      error.status = 400;
      throw error;
    }

    const movimento = movimentosPorId.get(String(item.id)) || {
      id: String(item.id),
      quantidadePendente: 0,
      quantidadeAtual: 0
    };
    movimento.quantidadePendente += quantidadeSolicitada;
    movimento.quantidadeAtual += quantidadeRecebida;
    movimentosPorId.set(movimento.id, movimento);
  });
  return [...movimentosPorId.values()];
};

// Reserva no campo quantidadePendente os itens de uma nova requisição.
// Se uma reserva falhar, desfaz as reservas já aplicadas antes de propagar o erro.
const reservarMovimentos = async (movimentos, filial) => {
  const reservados = [];
  try {
    for (const movimento of movimentos) {
      const resultado = await Suprimento.updateOne(
        {
          _id: movimento.id,
          filial,
          ativo: { $ne: false }
        },
        { $inc: { quantidadePendente: movimento.quantidadePendente } }
      );
      if (resultado.matchedCount !== 1) {
        const error = new Error(`O suprimento ${movimento.id} não foi encontrado nesta filial; não foi possível reservar o estoque.`);
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

// Desfaz reservas pendentes quando não foi possível concluir o cadastro da requisição.
const reverterReservas = async (movimentos, filial) => {
  for (const movimento of [...movimentos].reverse()) {
    const resultado = await Suprimento.updateOne(
      { _id: movimento.id, filial },
      { $inc: { quantidadePendente: -movimento.quantidadePendente } }
    );
    if (resultado.matchedCount !== 1) {
      throw new Error(`Não foi possível reverter a reserva do suprimento ${movimento.id}.`);
    }
  }
};

// Aplica recebimento ou liberação de pendências, verificando atomicamente que cada
// suprimento ainda tem saldo pendente suficiente. Se um item falhar, reverte os anteriores.
const aplicarMovimentos = async (movimentos, filial) => {
  const aplicados = [];
  try {
    for (const movimento of movimentos) {
      const resultado = await Suprimento.updateOne(
        {
          _id: movimento.id,
          filial,
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
        const suprimento = await Suprimento.findOne({
          _id: movimento.id,
          filial
        }).select('nome quantidadePendente');
        const error = new Error(suprimento
          ? `Quantidade pendente insuficiente para ${suprimento.nome}: existem ${suprimento.quantidadePendente} pendentes, mas a requisição precisa liberar ${movimento.quantidadePendente}.`
          : `O suprimento ${movimento.id} não foi encontrado na filial ${filial}; não foi possível atualizar o estoque.`);
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

// Reverte movimentos de estoque aplicados parcialmente durante o recebimento ou a exclusão.
const reverterMovimentos = async (movimentos, filial) => {
  for (const movimento of [...movimentos].reverse()) {
    await Suprimento.updateOne(
      { _id: movimento.id, filial },
      {
        $inc: {
          quantidadePendente: movimento.quantidadePendente,
          quantidadeAtual: -movimento.quantidadeAtual
        }
      }
    );
  }
};

// Exibe os suprimentos ativos e o histórico de requisições da filial selecionada.
exports.index = async (req, res, next) => {
  try {
    const filial = filialDoRequest(req);
    const suprimentos = await Suprimento.find({
      ativo: { $ne: false },
      filial
    }).sort({ nome: 1 });
    res.render('requisicoes_suprimentos', {
      title: 'Requisições',
      activePage: 'requisicoes',
      suprimentos,
      filial,
      requisicoes: await RequisicaoSuprimento.find({ filial }).sort({ data: -1 }).lean()
    });
  } catch (error) {
    next(error);
  }
};

// Valida os itens, reserva as quantidades pendentes, salva a requisição no MongoDB
// e monta o arquivo TXT agrupando os materiais por tipo.
exports.criar = async (req, res, next) => {
  if (operacaoEmAndamento) {
    return res.status(409).send('Já existe uma atualização de requisição em andamento. Tente novamente.');
  }
  operacaoEmAndamento = true;
  let movimentosReservados = [];
  let filial;
  try {
    filial = filialDoRequest(req);
    let itens;
    try {
      itens = JSON.parse(req.body.itens || '[]');
    } catch {
      return res.status(400).send('Lista de suprimentos inválida.');
    }

    if (!Array.isArray(itens) || !itens.length) {
      return res.status(400).send('Adicione pelo menos um suprimento.');
    }

    const ids = itens.map((item) => item.id);
    const suprimentos = await Suprimento.find({
      _id: { $in: ids },
      filial,
      ativo: { $ne: false }
    });
    const suprimentosPorId = new Map(suprimentos.map((item) => [String(item._id), item]));

    const itensNormalizados = [];
    for (const item of itens) {
      const suprimento = suprimentosPorId.get(String(item.id));
      const quantidade = Number(item.quantidade);
      if (!suprimento || !Number.isInteger(quantidade) || quantidade < 1) {
        return res.status(400).send('Existem suprimentos ou quantidades inválidos na requisição.');
      }
      itensNormalizados.push({
        id: String(suprimento._id),
        nome: suprimento.nome,
        impressora: suprimento.impressora || '',
        tipo: suprimento.tipo || '',
        quantidade
      });
    }

    const id = await gerarId();
    const requisicao = {
      id,
      filial,
      data: new Date(),
      status: 'Pendente',
      itens: itensNormalizados
    };

    movimentosReservados = await reservarMovimentos(
      criarMovimentos(itensNormalizados),
      filial
    );
    await RequisicaoSuprimento.create(requisicao);
    movimentosReservados = [];

    const tiposPrincipais = [/*'TONNER', 'UNIDADE DE IMAGEM'*/];
    const itensPorTipo = new Map();
    for (const item of itensNormalizados) {
      const tipo = item.tipo.trim() || 'SEM TIPO';
      const chaveTipo = tipo.toLocaleUpperCase('pt-BR');
      if (!itensPorTipo.has(chaveTipo)) {
        itensPorTipo.set(chaveTipo, { tipo, itens: [] });
      }
      itensPorTipo.get(chaveTipo).itens.push(item);
    }

    const tiposAdicionais = [...itensPorTipo.keys()]
      .filter((tipo) => !tiposPrincipais.includes(tipo))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const secoes = [...tiposPrincipais, ...tiposAdicionais].map((chaveTipo) => {
      const grupo = itensPorTipo.get(chaveTipo);
      const titulo = tiposPrincipais.includes(chaveTipo) ? chaveTipo : grupo?.tipo || chaveTipo;
      const linhas = (grupo?.itens || []).map((item) =>
        `${item.nome}, ${item.impressora || '-'}, ${item.quantidade}`
      );
      return [`${titulo}:`, '', ...linhas].join('\n');
    });
    const conteudo = [
      `REQUISIÇÃO DE SUPRIMENTOS`,
      // `ID: ${id}`,
      'Data: ' + new Date().toLocaleDateString('pt-BR'),
      `Filial: ${filial}`,
      '',
      secoes.join('\n\n')
    ].join('\n');

    console.log(`Requisição ${id} gerada com sucesso na filial ${filial}.`);

    req.flash('success', `Requisição ${id} gerada com sucesso.`);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="requisicao-${id}.txt"`);
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
    next(error);
  } finally {
    operacaoEmAndamento = false;
  }

};

// Confirma uma requisição pendente: libera do pendente a quantidade pedida,
// acrescenta ao estoque apenas o que foi recebido e registra status e data.
exports.receber = async (req, res, next) => {
  if (operacaoEmAndamento) {
    return res.status(409).send('Já existe uma atualização de requisição em andamento. Tente novamente.');
  }
  operacaoEmAndamento = true;
  const filial = filialDoRequest(req);
  const id = String(req.params.id);
  let movimentosAplicados = [];
  try {
    const requisicao = await RequisicaoSuprimento.findOne({ id, filial });
    if (!requisicao) {
      return redirecionarComMensagem(req, res, filial, id, 'error', 'Requisição não encontrada nesta filial.');
    }

    if (requisicao.status !== 'Pendente') {
      return redirecionarComMensagem(req, res, filial, id, 'error', 'Esta requisição já foi recebida.');
    }

    let movimentos;
    try {
      movimentos = criarMovimentos(requisicao.itens, req.body.quantidades ?? null);
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
    res.redirect(`/requisicoes-suprimentos?filial=${filial}`);
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

// Exclui a requisição. Se ainda estiver pendente, primeiro libera as quantidades
// reservadas; se já foi recebida, mantém o estoque como está.
exports.excluir = async (req, res, next) => {
  if (operacaoEmAndamento) {
    return res.status(409).send('Já existe uma atualização de requisição em andamento. Tente novamente.');
  }
  operacaoEmAndamento = true;
  const filial = filialDoRequest(req);
  const id = String(req.params.id);
  let movimentosAplicados = [];
  try {
    const requisicao = await RequisicaoSuprimento.findOne({ id, filial });
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
    const resultado = await RequisicaoSuprimento.deleteOne({ id, filial });
    if (resultado.deletedCount !== 1) {
      const error = new Error('A requisição não foi excluída do banco de dados.');
      error.status = 409;
      throw error;
    }
    movimentosAplicados = [];

    req.flash('success', `Requisição ${id} excluída.`);
    res.redirect(`/requisicoes-suprimentos?filial=${filial}`);
  } catch (error) {
    if (movimentosAplicados.length) {
      try {
        await reverterMovimentos(movimentosAplicados, filial);
      } catch (rollbackError) {
        return next(new Error(`${error.message} A reversão dos ajustes de estoque também falhou: ${rollbackError.message}`));
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
