const novoSuprimento = document.getElementById('novoSuprimento');
const formNovo = document.getElementById('formNovoSuprimento');

// Exibe o formulário de cadastro e posiciona o cursor no primeiro campo editável.
novoSuprimento?.addEventListener('click', () => {
  formNovo.hidden = false;
  formNovo.querySelector('input:not([type="hidden"])')?.focus();
});

// Oculta o formulário de cadastro ao cancelar.
document.querySelector('[data-close-form]')?.addEventListener('click', () => {
  formNovo.hidden = true;
});

// Abre a linha de edição do suprimento escolhido e fecha outras linhas de edição.
document.querySelectorAll('[data-edit]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[id^="edit-row-"]').forEach((row) => {
      row.hidden = true;
    });
    document.getElementById(`edit-row-${button.dataset.edit}`).hidden = false;
  });
});

// Fecha a linha de edição correspondente ao botão cancelar.
document.querySelectorAll('[data-close-edit]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(`edit-row-${button.dataset.closeEdit}`).hidden = true;
  });
});

// Filtra visualmente as linhas da tabela conforme o texto digitado.
document.getElementById('buscarSuprimento')?.addEventListener('input', (event) => {
  const termo = event.target.value.toLowerCase();
  document.querySelectorAll('[data-supply-row]').forEach((row) => {
    row.hidden = !row.textContent.toLowerCase().includes(termo);
  });
});
