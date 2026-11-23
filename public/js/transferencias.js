const formularioTransferencia = document.getElementById('formTransferencia');
const dialogTransferencia = document.querySelector('[data-transfer-dialog]');
const modalidadeTransferencia = document.querySelector('[data-transfer-mode]');
const filialDestinoTransferencia = document.querySelector('[data-transfer-branch]');
const tituloFilialTransferencia = document.querySelector('[data-transfer-branch-title]');
const tipoTransferencia = document.querySelector('[data-transfer-type]');
const buscaTransferencia = document.querySelector('[data-transfer-search]');
const itemTransferencia = document.querySelector('[data-transfer-select]');
const quantidadeTransferencia = document.querySelector('[data-transfer-quantity]');
const mensagemSemResultados = document.querySelector('[data-transfer-no-results]');
const listaTransferencia = document.querySelector('[data-transfer-list]');
const itensTransferencia = document.querySelector('[data-transfer-items]');
const mensagemSemItens = document.querySelector('[data-transfer-empty]');
const enviarTransferencia = document.querySelector('[data-submit-transfer]');
const itensSelecionados = [];
const opcoesOriginaisTransferencia = [...itemTransferencia.querySelectorAll('option[data-item-type]')];
const filialAtual = Number(document.querySelector('[data-current-branch]').dataset.currentBranch);

const filialDoEstoqueSelecionado = () => modalidadeTransferencia.value === 'requisicao'
  ? Number(filialDestinoTransferencia.value)
  : filialAtual;

const atualizarOpcoesTransferencia = () => {
  itemTransferencia.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = tipoTransferencia.value ? 'Selecione' : 'Selecione o tipo primeiro';
  itemTransferencia.append(placeholder);

  const termo = buscaTransferencia.value.trim().toLocaleLowerCase();
  const filialEstoque = filialDoEstoqueSelecionado();
  const opcoesDaFilial = opcoesOriginaisTransferencia.filter((option) =>
    Number(option.dataset.filial) === filialEstoque
  );
  [...tipoTransferencia.options].forEach((option) => {
    if (option.value) {
      option.disabled = !opcoesDaFilial.some((item) => item.dataset.itemType === option.value);
    }
  });
  const opcoesDisponiveis = opcoesDaFilial.filter((option) =>
    option.dataset.itemType === tipoTransferencia.value
  );
  const opcoesFiltradas = opcoesDisponiveis.filter((option) => {
    const selecionado = itensSelecionados.find((item) =>
      item.id === option.value && item.tipoItem === option.dataset.itemType
    );
    const saldoRestante = Number(option.dataset.available) - (selecionado?.quantidade || 0);
    return saldoRestante > 0
      && (!termo || option.dataset.search.toLocaleLowerCase().includes(termo));
  });

  opcoesFiltradas.forEach((option) => {
    const clone = option.cloneNode(true);
    const selecionado = itensSelecionados.find((item) =>
      item.id === option.value && item.tipoItem === option.dataset.itemType
    );
    const saldoRestante = Number(option.dataset.available) - (selecionado?.quantidade || 0);
    clone.hidden = false;
    clone.dataset.remaining = String(saldoRestante);
    clone.textContent = `${option.dataset.label} - Disponível: ${saldoRestante}`;
    itemTransferencia.append(clone);
  });
  itemTransferencia.disabled = !tipoTransferencia.value || opcoesFiltradas.length === 0;
  buscaTransferencia.disabled = !tipoTransferencia.value || opcoesDisponiveis.length === 0;
  mensagemSemResultados.hidden = !tipoTransferencia.value || opcoesFiltradas.length > 0;
  mensagemSemResultados.textContent = modalidadeTransferencia.value === 'requisicao'
    && !filialDestinoTransferencia.value
    ? 'Selecione a filial fornecedora para consultar o estoque.'
    : termo && opcoesDisponiveis.length
      ? 'Nenhum item disponível corresponde à busca.'
      : 'Não há itens com saldo disponível deste tipo nesta filial.';
  quantidadeTransferencia.removeAttribute('max');
};

const atualizarListaTransferencia = () => {
  listaTransferencia.replaceChildren();
  itensSelecionados.forEach((item, index) => {
    const linha = document.createElement('div');
    linha.className = 'request-item-row';
    const nome = document.createElement('strong');
    nome.textContent = `${item.tipoItem === 'produto' ? 'Produto' : 'Suprimento'}: ${item.nome}`;
    const quantidade = document.createElement('span');
    quantidade.textContent = `Quantidade: ${item.quantidade}`;
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'button-danger';
    remover.textContent = 'Remover';
    remover.addEventListener('click', () => {
      itensSelecionados.splice(index, 1);
      atualizarListaTransferencia();
    });
    linha.append(nome, quantidade, remover);
    listaTransferencia.append(linha);
  });
  itensTransferencia.value = JSON.stringify(
    itensSelecionados.map(({ id, tipoItem, quantidade }) => ({ id, tipoItem, quantidade }))
  );
  mensagemSemItens.hidden = itensSelecionados.length > 0;
  enviarTransferencia.disabled = itensSelecionados.length === 0;
};

const limparItensSelecionados = () => {
  itensSelecionados.splice(0, itensSelecionados.length);
  atualizarListaTransferencia();
  atualizarOpcoesTransferencia();
};

formularioTransferencia?.addEventListener('submit', (event) => {
  if (!formularioTransferencia.reportValidity()) {
    event.preventDefault();
    return;
  }
  if (!itensSelecionados.length) event.preventDefault();
});

modalidadeTransferencia?.addEventListener('change', () => {
  const solicitando = modalidadeTransferencia.value === 'requisicao';
  tituloFilialTransferencia.textContent = solicitando ? 'Filial fornecedora' : 'Filial destino';
  enviarTransferencia.textContent = solicitando ? 'Enviar solicitação' : 'Criar transferência';
  tipoTransferencia.value = '';
  buscaTransferencia.value = '';
  limparItensSelecionados();
});

filialDestinoTransferencia?.addEventListener('change', () => {
  if (modalidadeTransferencia.value === 'requisicao') {
    tipoTransferencia.value = '';
    buscaTransferencia.value = '';
    limparItensSelecionados();
  }
});

document.querySelector('[data-open-transfer-dialog]')?.addEventListener('click', () => {
  tipoTransferencia.value = '';
  buscaTransferencia.value = '';
  atualizarOpcoesTransferencia();
  quantidadeTransferencia.value = '1';
  dialogTransferencia.showModal();
  tipoTransferencia.focus();
});

tipoTransferencia?.addEventListener('change', atualizarOpcoesTransferencia);
buscaTransferencia?.addEventListener('input', atualizarOpcoesTransferencia);

itemTransferencia?.addEventListener('change', () => {
  const option = itemTransferencia.selectedOptions[0];
  quantidadeTransferencia.max = option?.dataset.remaining || '';
  quantidadeTransferencia.value = '1';
});

document.querySelector('[data-add-transfer-item]')?.addEventListener('click', () => {
  if (!tipoTransferencia.reportValidity() || !itemTransferencia.reportValidity()
    || !quantidadeTransferencia.reportValidity()) return;
  const option = itemTransferencia.selectedOptions[0];
  const itemExistente = itensSelecionados.find((item) =>
    item.id === itemTransferencia.value && item.tipoItem === tipoTransferencia.value
  );
  if (itemExistente) {
    itemExistente.quantidade += Number(quantidadeTransferencia.value);
  } else {
    itensSelecionados.push({
      id: itemTransferencia.value,
      tipoItem: tipoTransferencia.value,
      nome: option.dataset.label,
      quantidade: Number(quantidadeTransferencia.value)
    });
  }
  atualizarListaTransferencia();
  dialogTransferencia.close();
});

document.querySelector('[data-close-transfer-dialog]')?.addEventListener('click', () => {
  dialogTransferencia.close();
});

document.querySelectorAll('[data-open-transfer]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(`detalhe-transferencia-${button.dataset.openTransfer}`)?.showModal();
  });
});

document.querySelectorAll('[data-close-transfer]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog')?.close());
});

document.querySelectorAll('[data-confirm-transfer-receipt]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm('Confirma que recebeu todos os itens desta transferência?')) event.preventDefault();
  });
});

document.querySelectorAll('[data-send-transfer]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm('Confirma o envio? O saldo será baixado da filial fornecedora.')) event.preventDefault();
  });
});

document.querySelectorAll('[data-reject-transfer]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm('Confirma a rejeição desta solicitação?')) event.preventDefault();
  });
});

const transferenciaParaAbrir = new URLSearchParams(window.location.search).get('abrir');
if (transferenciaParaAbrir) {
  document.getElementById(`detalhe-transferencia-${transferenciaParaAbrir}`)?.showModal();
}
