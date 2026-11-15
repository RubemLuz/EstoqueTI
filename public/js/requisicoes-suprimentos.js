const adicionar = document.getElementById('adicionarItemRequisicao');
const dialog = document.getElementById('dialogSuprimento');
const suprimento = document.getElementById('suprimentoSelecionado');
const quantidade = document.getElementById('quantidadeSuprimento');
const confirmar = document.getElementById('confirmarItemRequisicao');
const lista = document.getElementById('listaItensRequisicao');
const mensagem = document.getElementById('mensagemSemItens');
const itensInput = document.getElementById('itensRequisicao');
const enviar = document.getElementById('enviarRequisicao');
const formularioRequisicao = document.getElementById('formRequisicao');
const itens = [];

// Mostra avisos de validação ou de erro junto ao formulário, sem recarregar a página.
const mostrarMensagem = (texto, tipo = 'error') => {
  let aviso = document.getElementById('mensagemRequisicao');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'mensagemRequisicao';
    aviso.className = 'request-notice';
    aviso.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    formularioRequisicao.before(aviso);
  }
  aviso.classList.toggle('request-notice-error', tipo === 'error');
  aviso.classList.toggle('request-notice-success', tipo === 'success');
  aviso.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  aviso.textContent = texto;
};

// Redesenha os itens selecionados e sincroniza o JSON enviado pelo formulário.
const atualizarLista = () => {
  lista.replaceChildren();
  itens.forEach((item, index) => {
    const linha = document.createElement('div');
    linha.className = 'request-item-row';
    const nome = document.createElement('strong');
    nome.textContent = item.nome;
    const quantidadeTexto = document.createElement('span');
    quantidadeTexto.textContent = `Quantidade: ${item.quantidade}`;
    linha.append(nome, quantidadeTexto);
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.className = 'button-danger';
    remover.textContent = 'Remover';
    remover.addEventListener('click', () => {
      itens.splice(index, 1);
      atualizarLista();
    });
    linha.append(remover);
    lista.append(linha);
  });
  itensInput.value = JSON.stringify(itens.map(({ id, quantidade }) => ({ id, quantidade })));
  mensagem.hidden = itens.length > 0;
  enviar.disabled = itens.length === 0;
};

// Envia a requisição sem navegação tradicional; em caso de sucesso baixa o TXT
// retornado e abre a lista da filial já com a requisição recém-criada selecionada.
formularioRequisicao?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (enviar.disabled) return;

  enviar.disabled = true;
  const textoOriginal = enviar.textContent;
  enviar.textContent = 'Enviando...';
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
    linkDownload.download = `requisicao-${id}.txt`;
    document.body.append(linkDownload);
    linkDownload.click();
    linkDownload.remove();
    window.setTimeout(() => URL.revokeObjectURL(urlArquivo), 1000);

    const filial = dadosRequisicao.get('filial');
    window.location.assign(
      `/requisicoes-suprimentos?filial=${encodeURIComponent(filial)}&abrir=${encodeURIComponent(id)}`
    );
  } catch (error) {
    mostrarMensagem(error.message);
    enviar.disabled = false;
    enviar.textContent = textoOriginal;
  }
});

// Abre o diálogo para escolher um suprimento e sua quantidade.
adicionar?.addEventListener('click', () => {
  suprimento.value = '';
  quantidade.value = '1';
  dialog.showModal();
  suprimento.focus();
});

// Valida a seleção, adiciona o material à lista da requisição e fecha o diálogo.
confirmar?.addEventListener('click', () => {
  if (!suprimento.value || !quantidade.reportValidity()) return;
  const option = suprimento.selectedOptions[0];
  itens.push({
    id: suprimento.value,
    nome: option.textContent,
    quantidade: Number(quantidade.value)
  });
  atualizarLista();
  dialog.close();
});

// Abre a janela de detalhes correspondente ao botão selecionado na tabela.
document.querySelectorAll('[data-open-request]').forEach((botao) => {
  botao.addEventListener('click', () => {
    const detalhe = document.getElementById(`detalhe-requisicao-${botao.dataset.openRequest}`);
    detalhe?.showModal();
  });
});

// Liga os controles de cada janela de detalhes: habilita a edição de quantidades
// para recebimento, fecha a janela, confirma exclusão e restaura os campos ao fechar.
document.querySelectorAll('.request-detail-dialog').forEach((detalhe) => {
  const formularioRecebimento = detalhe.querySelector('[data-receive-form]');
  const botaoRecebimento = detalhe.querySelector('[data-confirm-receipt]');

  botaoRecebimento?.addEventListener('click', (event) => {
    if (!botaoRecebimento.dataset.editing) {
      formularioRecebimento.querySelectorAll('.request-quantity').forEach((campo) => {
        campo.disabled = false;
      });
      botaoRecebimento.dataset.editing = 'true';
      botaoRecebimento.textContent = 'Recebido';
      return;
    }

    if (formularioRecebimento.reportValidity()) {
      formularioRecebimento.requestSubmit();
    }
  });

  detalhe.querySelector('[data-close-request]')?.addEventListener('click', () => {
    detalhe.close();
  });

  detalhe.querySelector('[data-delete-request]')?.addEventListener('submit', (event) => {
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

// Se o servidor redirecionou com o identificador da requisição, abre seus detalhes
// automaticamente após o carregamento da página.
const requisicaoParaAbrir = new URLSearchParams(window.location.search).get('abrir');
if (requisicaoParaAbrir) {
  document.getElementById(`detalhe-requisicao-${requisicaoParaAbrir}`)?.showModal();
}
