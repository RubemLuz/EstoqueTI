const ItemEstoque = require('../models/ItemEstoque');

exports.index = async (req, res, next) => {
  try {
    const itens = await ItemEstoque.find({ ativo: { $ne: false } });
    const criarResumo = (lista) => ({
      totalProdutos: lista.length,
      totalUnidades: lista.reduce((total, item) => total + item.quantidadeAtual, 0),
      abaixoMinimo: lista.filter((item) => item.quantidadeAtual < item.quantidadeMinima).length
    });
    const filialNormalizada = (item) => [1, 3, 4].includes(item.filial) ? item.filial : 4;
    const resumoGeral = criarResumo(itens);
    const filialSelecionada = [1, 3, 4].includes(Number(req.query.filial)) ? Number(req.query.filial) : 1;
    const resumoFilialSelecionada = criarResumo(
      itens.filter((item) => filialNormalizada(item) === filialSelecionada)
    );

  res.render('index', {
    title: 'Início',
    activePage: 'inicio',
    resumoGeral,
    resumoFilialSelecionada,
    filialSelecionada
  });
  } catch (error) {
    next(error);
  }
};
