const ItemEstoque = require('../models/ItemEstoque');
const Suprimento = require('../models/Suprimento');
const Transferencia = require('../models/Transferencia');
const RequisicaoEstoque = require('../models/RequisicaoEstoque');
const RequisicaoSuprimento = require('../models/RequisicaoSuprimento');

const filtroProdutosFilial = (filial) => filial === 4
  ? { $or: [{ filial: 4 }, { filial: { $exists: false } }] }
  : { filial };

const listarItens = (itens) => itens
  .map((item) => `${item.nome} (${item.quantidade})`)
  .join(', ');

exports.index = async (req, res, next) => {
  try {
    const filialSelecionada = [1, 3, 4].includes(Number(req.query.filial))
      ? Number(req.query.filial)
      : 1;
    const permissoes = req.usuario.permissoes || {};
    const podeVerSuprimentos = req.usuario.administrador || permissoes.suprimentos;
    const podeVerTransferencias = req.usuario.administrador || permissoes.transferencias;
    const podeVerRequisicoesEstoque = req.usuario.administrador || permissoes.estoqueRequisicoes;
    const podeVerRequisicoesSuprimentos = req.usuario.administrador || permissoes.requisicoes;
    const [
      itens,
      suprimentos,
      transferenciasACaminho,
      solicitacoesTransferencia,
      requisicoesEstoque,
      requisicoesSuprimentos
    ] = await Promise.all([
      ItemEstoque.find({ ativo: { $ne: false } }).lean(),
      podeVerSuprimentos
        ? Suprimento.find({ filial: filialSelecionada, ativo: { $ne: false } }).lean()
        : [],
      podeVerTransferencias
        ? Transferencia.find({
            status: 'Enviado',
            $or: [
              { modalidade: 'envio', filialDestino: filialSelecionada },
              { modalidade: 'requisicao', filialOrigem: filialSelecionada },
              { modalidade: { $exists: false }, filialDestino: filialSelecionada }
            ]
          }).sort({ dataEnvio: -1, data: -1 }).lean()
        : [],
      podeVerTransferencias
        ? Transferencia.find({
            filialDestino: filialSelecionada,
            modalidade: 'requisicao',
            status: 'Solicitado'
          }).sort({ data: -1 }).lean()
        : [],
      podeVerRequisicoesEstoque
        ? RequisicaoEstoque.find({ filial: filialSelecionada, status: 'Pendente' }).sort({ data: -1 }).lean()
        : [],
      podeVerRequisicoesSuprimentos
        ? RequisicaoSuprimento.find({ filial: filialSelecionada, status: 'Pendente' }).sort({ data: -1 }).lean()
        : []
    ]);

    const criarResumo = (lista) => ({
      totalProdutos: lista.length,
      totalUnidades: lista.reduce((total, item) => total + item.quantidadeAtual, 0),
      abaixoMinimo: lista.filter((item) => item.quantidadeAtual <= item.quantidadeMinima).length
    });
    const filialNormalizada = (item) => [1, 3, 4].includes(item.filial) ? item.filial : 4;
    const resumoGeral = criarResumo(itens);
    const resumoFilialSelecionada = criarResumo(
      itens.filter((item) => filialNormalizada(item) === filialSelecionada)
    );

    const avisos = [
      ...itens
        .filter((item) =>
          filialNormalizada(item) === filialSelecionada
          && item.quantidadeAtual <= item.quantidadeMinima
        )
        .map((item) => ({
          categoria: 'Estoque baixo · Equipamento',
          titulo: item.nome,
          descricao: `Saldo: ${item.quantidadeAtual} · Mínimo: ${item.quantidadeMinima}`,
          href: `/entrada_estoque?filial=${filialSelecionada}#produto-${item._id}`
        })),
      ...suprimentos
        .filter((item) => item.quantidadeAtual <= item.quantidadeMinima)
        .map((item) => ({
          categoria: 'Estoque baixo · Suprimento',
          titulo: item.nome,
          descricao: `Saldo: ${item.quantidadeAtual} · Mínimo: ${item.quantidadeMinima}`,
          href: `/suprimentos?filial=${filialSelecionada}#suprimento-${item._id}`
        })),
      ...transferenciasACaminho.map((transferencia) => ({
        categoria: 'Transferência a caminho',
        titulo: `Pedido ${transferencia.id}`,
        descricao: `${transferencia.modalidade === 'requisicao' ? 'Solicitação atendida pela' : 'Enviada pela'} Filial ${transferencia.modalidade === 'requisicao' ? transferencia.filialDestino : transferencia.filialOrigem} · ${listarItens(transferencia.itens)}`,
        href: `/transferencias?filial=${filialSelecionada}&abrir=${encodeURIComponent(transferencia.id)}`
      })),
      ...solicitacoesTransferencia.map((transferencia) => ({
        categoria: 'Solicitação de outra filial',
        titulo: `Pedido ${transferencia.id} · Filial ${transferencia.filialOrigem}`,
        descricao: listarItens(transferencia.itens),
        href: `/transferencias?filial=${filialSelecionada}&abrir=${encodeURIComponent(transferencia.id)}`
      })),
      ...requisicoesEstoque.map((requisicao) => ({
        categoria: 'Requisição de equipamento pendente',
        titulo: `Requisição ${requisicao.id}`,
        descricao: listarItens(requisicao.itens),
        href: `/requisicoes-estoque?filial=${filialSelecionada}&abrir=${encodeURIComponent(requisicao.id)}`
      })),
      ...requisicoesSuprimentos.map((requisicao) => ({
        categoria: 'Requisição de suprimentos pendente',
        titulo: `Requisição ${requisicao.id}`,
        descricao: listarItens(requisicao.itens),
        href: `/requisicoes-suprimentos?filial=${filialSelecionada}&abrir=${encodeURIComponent(requisicao.id)}`
      }))
    ];

    res.render('index', {
      title: 'Início',
      activePage: 'inicio',
      resumoGeral,
      resumoFilialSelecionada,
      filialSelecionada,
      avisos
    });
  } catch (error) {
    next(error);
  }
};
