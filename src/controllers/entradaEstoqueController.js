const ItemEstoque = require('../models/ItemEstoque');

const filtroFilial = (filial) => filial === 4
  ? { $or: [{ filial: 4 }, { filial: { $exists: false } }] }
  : { filial };

const dadosProduto = (body, filial) => ({
  nome: body.nome,
  filial,
  modelo: body.modelo,
  informacaoExtra: body.informacaoExtra,
  categoria: body.categoria,
  quantidadeAtual: Number(body.quantidadeAtual ?? 0),
  quantidadeMinima: Number(body.quantidadeMinima ?? 0),
  quantidadePendente: Number(body.quantidadePendente ?? 0),
  observacao: body.observacao
});

const voltarParaEstoque = (req, res) => res.redirect(`/entrada_estoque?filial=${req.filial}`);

exports.index = async (req, res, next) => {
  try {
    const filial = req.filial;
    const itens = await ItemEstoque.find({
      ativo: { $ne: false },
      ...filtroFilial(filial)
    }).sort({ nome: 1 });
    res.render('entrada_estoque', { title: 'Consultar estoque', itens, filial });
  } catch (error) {
    next(error);
  }
};

exports.criar = async (req, res, next) => {
  try {
    await ItemEstoque.create(dadosProduto(req.body, req.filial));
    req.flash('success', 'Produto adicionado ao estoque.');
    voltarParaEstoque(req, res);
  } catch (error) {
    next(error);
  }
};

exports.editar = async (req, res, next) => {
  try {
    const produto = await ItemEstoque.findOneAndUpdate(
      {
        _id: req.params.id,
        ...filtroFilial(req.filial),
        ativo: { $ne: false }
      },
      dadosProduto(req.body, req.filial),
      { runValidators: true }
    );
    if (!produto) {
      req.flash('error', 'Produto não encontrado nesta filial ou já desativado.');
      return voltarParaEstoque(req, res);
    }
    req.flash('success', 'Produto atualizado.');
    voltarParaEstoque(req, res);
  } catch (error) {
    next(error);
  }
};

exports.desativar = async (req, res, next) => {
  try {
    const produto = await ItemEstoque.findOneAndUpdate(
      {
        _id: req.params.id,
        ...filtroFilial(req.filial),
        ativo: { $ne: false }
      },
      { ativo: false },
      { runValidators: true }
    );
    if (!produto) {
      req.flash('error', 'Produto não encontrado nesta filial ou já desativado.');
      return voltarParaEstoque(req, res);
    }
    req.flash('success', 'Produto desativado.');
    voltarParaEstoque(req, res);
  } catch (error) {
    next(error);
  }
};

exports.relatorio = async (req, res, next) => {
  try {
    const filial = req.filial;
    const itens = await ItemEstoque.find({
      ativo: { $ne: false },
      ...filtroFilial(filial)
    }).sort({ categoria: 1, nome: 1 });

    const itensPorCategoria = new Map();
    for (const item of itens) {
      const categoria = item.categoria?.trim() || 'SEM CATEGORIA';
      const chaveCategoria = categoria.toLocaleUpperCase('pt-BR');
      if (!itensPorCategoria.has(chaveCategoria)) {
        itensPorCategoria.set(chaveCategoria, { categoria, itens: [] });
      }
      itensPorCategoria.get(chaveCategoria).itens.push(item);
    }

    const secoes = [...itensPorCategoria.values()].map(({ categoria, itens: itensDaCategoria }) => [
      `${categoria}:`,
      '',
      ...itensDaCategoria.map((item) =>
        `${item.nome}, ${item.modelo || '-'}, ${item.informacaoExtra || '-'}, ${item.quantidadeAtual}`
      )
    ].join('\n'));

    const conteudo = [
      `RELATÓRIO DE ESTOQUE - FILIAL ${filial}`,
      'Data: ' + new Date().toLocaleDateString('pt-BR'),
      '',
      ...(secoes.length ? [secoes.join('\n\n')] : ['Nenhum produto ativo cadastrado.'])
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="estoque-filial-${filial}.txt"`);
    res.send(`\uFEFF${conteudo}`);
  } catch (error) {
    next(error);
  }
};
