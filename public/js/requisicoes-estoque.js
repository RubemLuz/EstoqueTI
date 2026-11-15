const adicionarProduto = document.getElementById('adicionarItemRequisicaoEstoque');
const dialogProduto = document.getElementById('dialogProdutoEstoque');
const produtoSelecionado = document.getElementById('produtoEstoqueSelecionado');
const quantidadeProduto = document.getElementById('quantidadeProdutoEstoque');
const confirmarProduto = document.getElementById('confirmarItemRequisicaoEstoque');
const listaProdutos = document.getElementById('listaItensRequisicaoEstoque');
const mensagemSemProdutos = document.getElementById('mensagemSemItensEstoque');
const itensInput = document.getElementById('itensRequisicaoEstoque');
const enviarRequisicao = document.getElementById('enviarRequisicaoEstoque');
const formularioRequisicao = document.getElementById('formRequisicaoEstoque');
const itens = [];

const mostrarMensagem = (texto) => {
  let aviso = document.getElementById('mensagemRequisicaoEstoque');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'mensagemRequisicaoEstoque';
    aviso.className = 'request-notice request-notice-error';
    aviso.setAttribute('role', 'alert');
    formularioRequisicao.before(aviso);
  }
  aviso.textContent = texto;
};

const atualizarLista = () => {
  listaProdutos.replaceChildren();
  itens.forEach((item, index) => {
    const linha = document.createElement('div');
    linha.className = 'request-item-row';
    const nome = document.createElement('strong');
    nome.textContent = item.nome;
    const quantidadeTexto = document.createElement('span');
    quantidadeTexto.textContent = `Quantidade: ${item.quantidade}`;
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'button-danger';
    remover.textContent = 'Remover';
    remover.addEventListener('click', () => {
      itens.splice(index, 1);
      atualizarLista();
    });
    linha.append(nome, quantidadeTexto, remover);
    listaProdutos.append(linha);
  });
  itensInput.value = JSON.stringify(itens.map(({ id, quantidade }) => ({ id, quantidade })));
  mensagemSemProdutos.hidden = itens.length > 0;
  enviarRequisicao.disabled = itens.length === 0;
};

formularioRequisicao?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (enviarRequisicao.disabled) return;

  enviarRequisicao.disabled = true;
  const textoOriginal = enviarRequisicao.textContent;
  enviarRequisicao.textContent = 'Enviando...';
  try {
    const dadosRequisicao = new URLSearchParams(new FormData(formularioRequisicao));
    const resposta = await fetch(formularioRequisicao.action, {
      method: 'POST',
      body: dadosRequisicao,
      headers: { Accept: 'text/plain' }
    });
    if (!resposta.ok) {
      throw new Error((await resposta.text()) || 'Não foi possível criar a requisição.');
    }

    const id = resposta.headers.get('X-Requisicao-Id');
    if (!id) throw new Error('A requisição foi criada, mas o servidor não retornou o número dela.');

    const arquivo = new Blob([await resposta.blob()], { type: 'text/plain;charset=utf-8' });
    const urlArquivo = URL.createObjectURL(arquivo);
    const linkDownload = document.createElement('a');
    linkDownload.href = urlArquivo;
    linkDownload.download = `requisicao-estoque-${id}.txt`;
    document.body.append(linkDownload);
    linkDownload.click();
    linkDownload.remove();
    window.setTimeout(() => URL.revokeObjectURL(urlArquivo), 1000);

    const filial = dadosRequisicao.get('filial');
    window.location.assign(
      `/requisicoes-estoque?filial=${encodeURIComponent(filial)}&abrir=${encodeURIComponent(id)}`
    );
  } catch (error) {
    mostrarMensagem(error.message);
    enviarRequisicao.disabled = false;
    enviarRequisicao.textContent = textoOriginal;
  }
});

adicionarProduto?.addEventListener('click', () => {
  produtoSelecionado.value = '';
  quantidadeProduto.value = '1';
  dialogProduto.showModal();
  produtoSelecionado.focus();
});

confirmarProduto?.addEventListener('click', () => {
  if (!produtoSelecionado.reportValidity() || !quantidadeProduto.reportValidity()) return;
  const option = produtoSelecionado.selectedOptions[0];
  itens.push({
    id: produtoSelecionado.value,
    nome: option.textContent,
    quantidade: Number(quantidadeProduto.value)
  });
  atualizarLista();
  dialogProduto.close();
});

dialogProduto?.querySelector('[data-close-product-dialog]')?.addEventListener('click', () => {
  dialogProduto.close();
});

document.querySelectorAll('[data-open-stock-request]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(`detalhe-requisicao-estoque-${button.dataset.openStockRequest}`)?.showModal();
  });
});

document.querySelectorAll('.request-detail-dialog').forEach((detalhe) => {
  const formularioRecebimento = detalhe.querySelector('[data-receive-stock-form]');
  const botaoRecebimento = detalhe.querySelector('[data-confirm-stock-receipt]');

  botaoRecebimento?.addEventListener('click', () => {
    if (!botaoRecebimento.dataset.editing) {
      formularioRecebimento.querySelectorAll('.request-quantity').forEach((campo) => {
        campo.disabled = false;
      });
      botaoRecebimento.dataset.editing = 'true';
      botaoRecebimento.textContent = 'Confirmar recebimento';
      return;
    }
    if (formularioRecebimento.reportValidity()) formularioRecebimento.requestSubmit();
  });

  detalhe.querySelector('[data-close-stock-request]')?.addEventListener('click', () => detalhe.close());
  detalhe.querySelector('[data-delete-stock-request]')?.addEventListener('submit', (event) => {
    if (!window.confirm('Deseja excluir esta requisição?')) event.preventDefault();
  });

  detalhe.addEventListener('close', () => {
    formularioRecebimento?.querySelectorAll('.request-quantity').forEach((campo) => {
      campo.value = campo.dataset.originalValue;
      campo.disabled = true;
    });
    if (botaoRecebimento) {
      delete botaoRecebimento.dataset.editing;
      botaoRecebimento.textContent = 'Receber';
    }
  });
});

const requisicaoParaAbrir = new URLSearchParams(window.location.search).get('abrir');
if (requisicaoParaAbrir) {
  document.getElementById(`detalhe-requisicao-estoque-${requisicaoParaAbrir}`)?.showModal();
}
