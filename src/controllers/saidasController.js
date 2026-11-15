const ItemEstoque = require('../models/ItemEstoque');
const Suprimento = require('../models/Suprimento');
const SaidaSuprimento = require('../models/SaidaSuprimento');

const filtroProdutosFilial = (filial) => filial === 4
  ? { $or: [{ filial: 4 }, { filial: { $exists: false } }] }
  : { filial };

const filtroSuprimentosFilial = (filial) => ({ filial });

const voltarParaSaida = (res, rota, filial) => {
  res.redirect(`/${rota}?filial=${filial}`);
};

const lerItens = (valor) => {
  let itens;
  try {
    itens = JSON.parse(valor || '[]');
  } catch {
    const error = new Error('A lista de itens da saída está inválida.');
    error.status = 400;
    throw error;
  }

  if (!Array.isArray(itens) || !itens.length) {
    const error = new Error('Adicione pelo menos um item antes de confirmar a saída.');
    error.status = 400;
    throw error;
  }

  const quantidadesPorId = new Map();
  for (const item of itens) {
    if (!item || typeof item !== 'object') {
      const error = new Error('Existem itens ou quantidades inválidos na saída.');
      error.status = 400;
      throw error;
    }
    const id = String(item.id || '');
    const quantidade = Number(item.quantidade);
    if (!id || !Number.isInteger(quantidade) || quantidade < 1) {
      const error = new Error('Existem itens ou quantidades inválidos na saída.');
      error.status = 400;
      throw error;
    }
    quantidadesPorId.set(id, (quantidadesPorId.get(id) || 0) + quantidade);
  }
  return [...quantidadesPorId].map(([id, quantidade]) => ({ id, quantidade }));
};

const prepararItens = async (Model, itens, filial, filtroFilial, tipo) => {
  const registros = await Model.find({
    _id: { $in: itens.map((item) => item.id) },
    ativo: { $ne: false },
    ...filtroFilial(filial)
  });
  const registrosPorId = new Map(registros.map((registro) => [String(registro._id), registro]));
  const itensNormalizados = [];

  for (const item of itens) {
    const registro = registrosPorId.get(item.id);
    if (!registro) {
      const error = new Error(`Um ${tipo} selecionado não está ativo ou não pertence a esta filial.`);
      error.status = 409;
      throw error;
    }
    itensNormalizados.push({
      id: item.id,
      nome: registro.nome,
      ...(tipo === 'produto'
        ? { modelo: registro.modelo || '', categoria: registro.categoria || '' }
        : { impressora: registro.impressora || '', tipo: registro.tipo || '' }),
      quantidade: item.quantidade
    });
  }
  return itensNormalizados;
};

const reverterBaixas = async (Model, itens, filial, filtroFilial) => {
  for (const item of [...itens].reverse()) {
    const resultado = await Model.updateOne(
      { _id: item.id, ...filtroFilial(filial) },
      { $inc: { quantidadeAtual: item.quantidade } }
    );
    if (resultado.matchedCount !== 1) {
      throw new Error(`Não foi possível reverter a baixa de ${item.nome}.`);
    }
  }
};

const baixarItens = async (Model, itens, filial, filtroFilial) => {
  const baixados = [];
  try {
    for (const item of itens) {
      const resultado = await Model.updateOne(
        {
          _id: item.id,
          ...filtroFilial(filial),
          ativo: { $ne: false },
          quantidadeAtual: { $gte: item.quantidade }
        },
        { $inc: { quantidadeAtual: -item.quantidade } }
      );
      if (resultado.matchedCount !== 1) {
        const registro = await Model.findOne({
          _id: item.id,
          ...filtroFilial(filial)
        }).select('nome quantidadeAtual ativo');
        const error = new Error(!registro || registro.ativo === false
          ? `${item.nome} não está mais ativo nesta filial.`
          : `Saldo insuficiente para ${item.nome}. Disponível: ${registro.quantidadeAtual}.`);
        error.status = 409;
        throw error;
      }
      baixados.push(item);
    }
    return baixados;
  } catch (error) {
    try {
      await reverterBaixas(Model, baixados, filial, filtroFilial);
    } catch (rollbackError) {
      throw new Error(`${error.message} A reversão das baixas anteriores também falhou: ${rollbackError.message}`);
    }
    throw error;
  }
};

const validarData = (valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return null;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia
    ? data
    : null;
};

const dataNoFormatoInput = (data) => [
  data.getFullYear(),
  String(data.getMonth() + 1).padStart(2, '0'),
  String(data.getDate()).padStart(2, '0')
].join('-');

const periodoDasDatas = (query) => {
  const hoje = new Date();
  let inicio;
  let fim;
  let periodo = String(query.periodo
    || (query.dataInicio || query.dataFim ? 'personalizado' : 'mensal'));

  if (periodo === 'semanal') {
    fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    inicio = new Date(fim);
    const diasDesdeSegunda = (inicio.getDay() + 6) % 7;
    inicio.setDate(inicio.getDate() - diasDesdeSegunda);
  } else if (periodo === 'mensal') {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  } else {
    periodo = 'personalizado';
    inicio = validarData(query.dataInicio);
    fim = validarData(query.dataFim);
    if (!inicio || !fim || inicio > fim) return null;
  }

  const inicioInclusivo = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const fimExclusivo = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1);
  return {
    periodo,
    dataInicio: dataNoFormatoInput(inicioInclusivo),
    dataFim: dataNoFormatoInput(fim),
    inicio: inicioInclusivo,
    fimExclusivo
  };
};

const buscarSaidasSuprimentos = (filial, periodo) => SaidaSuprimento.find({
  filial,
  data: { $gte: periodo.inicio, $lt: periodo.fimExclusivo }
}).sort({ data: -1 }).lean();

exports.indexProdutos = async (req, res, next) => {
  try {
    const filial = req.filial;
    const produtos = await ItemEstoque.find({
      ativo: { $ne: false },
      ...filtroProdutosFilial(filial)
    }).sort({ nome: 1 });
    res.render('saidas_produtos', {
      title: 'Saída de Produtos',
      activePage: 'entrada',
      filial,
      produtos
    });
  } catch (error) {
    next(error);
  }
};

exports.criarSaidaProdutos = async (req, res, next) => {
  const filial = req.filial;
  try {
    const itens = await prepararItens(
      ItemEstoque,
      lerItens(req.body.itens),
      filial,
      filtroProdutosFilial,
      'produto'
    );
    await baixarItens(ItemEstoque, itens, filial, filtroProdutosFilial);
    req.flash('success', 'Saída de produtos confirmada e estoque atualizado.');
    voltarParaSaida(res, 'saidas-produtos', filial);
  } catch (error) {
    if (error.status === 400 || error.status === 409) {
      req.flash('error', error.message);
      return voltarParaSaida(res, 'saidas-produtos', filial);
    }
    next(error);
  }
};

exports.indexSuprimentos = async (req, res, next) => {
  try {
    const filial = req.filial;
    const periodo = periodoDasDatas(req.query);
    if (!periodo) {
      req.flash('error', 'Informe um período válido, com data inicial anterior à data final.');
      return res.redirect(`/saidas-suprimentos?filial=${filial}`);
    }

    const [suprimentos, saidas] = await Promise.all([
      Suprimento.find({
        ativo: { $ne: false },
        ...filtroSuprimentosFilial(filial)
      }).sort({ nome: 1 }),
      buscarSaidasSuprimentos(filial, periodo)
    ]);
    res.render('saidas_suprimentos', {
      title: 'Saída de Suprimentos',
      activePage: 'suprimentos',
      filial,
      suprimentos,
      saidas,
      periodo
    });
  } catch (error) {
    next(error);
  }
};

exports.criarSaidaSuprimentos = async (req, res, next) => {
  const filial = req.filial;
  let baixados = [];
  try {
    const itens = await prepararItens(
      Suprimento,
      lerItens(req.body.itens),
      filial,
      filtroSuprimentosFilial,
      'suprimento'
    );
    baixados = await baixarItens(Suprimento, itens, filial, filtroSuprimentosFilial);
    await SaidaSuprimento.create({
      filial,
      data: new Date(),
      usuario: req.usuario.nome,
      itens
    });
    baixados = [];
    req.flash('success', 'Saída de suprimentos confirmada e estoque atualizado.');
    voltarParaSaida(res, 'saidas-suprimentos', filial);
  } catch (error) {
    if (baixados.length) {
      try {
        await reverterBaixas(Suprimento, baixados, filial, filtroSuprimentosFilial);
      } catch (rollbackError) {
        return next(new Error(`${error.message} A reversão das baixas também falhou: ${rollbackError.message}`));
      }
    }
    if (error.status === 400 || error.status === 409) {
      req.flash('error', error.message);
      return voltarParaSaida(res, 'saidas-suprimentos', filial);
    }
    next(error);
  }
};

exports.relatorioSuprimentos = async (req, res, next) => {
  try {
    const filial = req.filial;
    const periodo = periodoDasDatas(req.query);
    if (!periodo) {
      req.flash('error', 'Informe um período válido, com data inicial anterior à data final.');
      return res.redirect(`/saidas-suprimentos?filial=${filial}`);
    }

    const saidas = await buscarSaidasSuprimentos(filial, periodo);
    const totaisPorItem = new Map();
    for (const saida of saidas) {
      for (const item of saida.itens) {
        const chave = `${item.id}:${item.nome}`;
        totaisPorItem.set(chave, {
          nome: item.nome,
          impressora: item.impressora || '',
          tipo: item.tipo || '',
          quantidade: (totaisPorItem.get(chave)?.quantidade || 0) + item.quantidade
        });
      }
    }

    const conteudo = [
      `RELATÓRIO DE SAÍDAS DE SUPRIMENTOS - FILIAL ${filial}`,
      `Período: ${periodo.dataInicio} a ${periodo.dataFim}`,
      '',
      'TOTAL POR SUPRIMENTO:',
      ...(totaisPorItem.size
        ? [...totaisPorItem.values()].map((item) =>
          `${item.nome}, ${item.impressora || '-'}, ${item.tipo || '-'}, ${item.quantidade}`
        )
        : ['Nenhuma saída no período.']),
      '',
      'MOVIMENTAÇÕES:',
      ...(saidas.length
        ? saidas.flatMap((saida) => [
          `${new Date(saida.data).toLocaleString('pt-BR')} - ${saida.usuario}`,
          ...saida.itens.map((item) =>
            `  ${item.nome}, ${item.impressora || '-'}, ${item.quantidade}`
          ),
          ''
        ])
        : ['Nenhuma saída no período.'])
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="saidas-suprimentos-${periodo.dataInicio}-${periodo.dataFim}.txt"`
    );
    res.send(`\uFEFF${conteudo}`);
  } catch (error) {
    next(error);
  }
};
