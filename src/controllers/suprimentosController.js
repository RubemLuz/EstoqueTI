const Suprimento = require('../models/Suprimento');

// Resolve a filial a partir da URL ou do formulário; valores inválidos usam a filial 1.
const filialDoRequest = (req) => {
  const filial = Number(req.filial ?? req.query?.filial ?? req.body?.filial ?? 1);
  return [1, 3, 4].includes(filial) ? filial : 1;
};

// Mantém explícito o filtro de filial nas consultas e atualizações de suprimentos.
const filtroFilial = (filial) => ({
  filial: { $eq: filial }
});

// Converte os valores do formulário para os tipos esperados pelo modelo.
const dadosSuprimento = (body, filial) => ({
  nome: body.nome,
  filial,
  impressora: body.impressora,
  tipo: body.tipo,
  quantidadeAtual: Number(body.quantidadeAtual ?? 0),
  quantidadeMinima: Number(body.quantidadeMinima ?? 0),
  quantidadePendente: Number(body.quantidadePendente ?? 0)
});

// Lista os suprimentos ativos somente da filial selecionada e renderiza a página.
exports.index = async (req, res, next) => {
  try {
    const filial = filialDoRequest(req);
    const suprimentos = await Suprimento.find({
      ativo: { $ne: false },
      ...filtroFilial(filial)
    }).sort({ nome: 1 });
    res.render('suprimentos', { title: 'Suprimentos', activePage: 'suprimentos', suprimentos, filial });
  } catch (error) {
    next(error);
  }
};

// Cria um suprimento com os dados enviados pelo formulário e retorna à mesma filial.
exports.criar = async (req, res, next) => {
  try {
    await Suprimento.create(dadosSuprimento(req.body, filialDoRequest(req)));
    req.flash('success', 'Suprimento adicionado.');
    res.redirect(`/suprimentos?filial=${Number(req.body?.filial ?? 1)}`);
  } catch (error) {
    next(error);
  }
};

// Atualiza o suprimento identificado, limitado à filial selecionada.
exports.editar = async (req, res, next) => {
  try {
    const filial = filialDoRequest(req);
    const suprimento = await Suprimento.findOneAndUpdate(
      { _id: req.params.id, ...filtroFilial(filial), ativo: { $ne: false } },
      dadosSuprimento(req.body, filial),
      { runValidators: true }
    );
    if (!suprimento) {
      req.flash('error', 'Suprimento não encontrado nesta filial ou já desativado.');
      return res.redirect(`/suprimentos?filial=${filial}`);
    }
    req.flash('success', 'Suprimento atualizado.');
    res.redirect(`/suprimentos?filial=${filial}`);
  } catch (error) {
    next(error);
  }
};

// Desativa o registro sem apagá-lo do banco, mantendo o histórico.
exports.desativar = async (req, res, next) => {
  try {
    const filial = filialDoRequest(req);
    const suprimento = await Suprimento.findOneAndUpdate(
      { _id: req.params.id, ...filtroFilial(filial), ativo: { $ne: false } },
      { ativo: false },
      { runValidators: true }
    );
    if (!suprimento) {
      req.flash('error', 'Suprimento não encontrado nesta filial ou já desativado.');
      return res.redirect(`/suprimentos?filial=${filial}`);
    }
    req.flash('success', 'Suprimento desativado.');
    res.redirect(`/suprimentos?filial=${filial}`);
  } catch (error) {
    next(error);
  }
};

// Gera um TXT da filial selecionada, agrupando os suprimentos pelo tipo.
exports.relatorio = async (req, res, next) => {
  try {
    const filial = filialDoRequest(req);
    const suprimentos = await Suprimento.find({
      ativo: { $ne: false },
      ...filtroFilial(filial)
    }).sort({ nome: 1 });

    // Essas categorias aparecem primeiro, mesmo que não tenham itens cadastrados.
    const tiposPrincipais = ['TONNER', 'UNIDADE DE IMAGEM'];
    const suprimentosPorTipo = new Map();
    for (const suprimento of suprimentos) {
      const tipo = suprimento.tipo?.trim() || 'SEM TIPO';
      // A chave em maiúsculas junta variações de caixa, mas mantém o nome original na seção.
      const chaveTipo = tipo.toLocaleUpperCase('pt-BR');
      if (!suprimentosPorTipo.has(chaveTipo)) {
        suprimentosPorTipo.set(chaveTipo, { tipo, itens: [] });
      }
      suprimentosPorTipo.get(chaveTipo).itens.push(suprimento);
    }

    const tiposAdicionais = [...suprimentosPorTipo.keys()]
      .filter((tipo) => !tiposPrincipais.includes(tipo))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    // Cada seção contém o cabeçalho de colunas e as linhas no formato Nome, Impressora, quantidade.
    const secoes = [...tiposPrincipais, ...tiposAdicionais].map((chaveTipo) => {
      const grupo = suprimentosPorTipo.get(chaveTipo);
      const titulo = tiposPrincipais.includes(chaveTipo) ? chaveTipo : grupo?.tipo || chaveTipo;
      const linhas = (grupo?.itens || []).map((suprimento) =>
        `${suprimento.nome}, ${suprimento.impressora || '-'}, ${suprimento.quantidadeAtual}`
      );
      return [`${titulo}:`, '', ...linhas].join('\n');
    });
    const conteudo = [
      `RELATÓRIO DE SUPRIMENTOS - FILIAL ${filial}`,
      'Data: ' + new Date().toLocaleDateString('pt-BR'),
      '',
      ...(suprimentos.length ? [secoes.join('\n\n')] : ['Nenhum suprimento ativo cadastrado.'])
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="suprimentos-filial-${filial}.txt"`);
    res.send(`\uFEFF${conteudo}`);
  } catch (error) {
    next(error);
  }
};
