const formNovoProduto = document.getElementById('formNovoProduto');

document.getElementById('novoProduto')?.addEventListener('click', () => {
  formNovoProduto.hidden = false;
  formNovoProduto.querySelector('input:not([type="hidden"])')?.focus();
});

document.querySelector('[data-close-new-product]')?.addEventListener('click', () => {
  formNovoProduto.hidden = true;
});

document.querySelectorAll('[data-edit-product]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[id^="edit-product-row-"]').forEach((row) => {
      row.hidden = true;
    });
    document.getElementById(`edit-product-row-${button.dataset.editProduct}`).hidden = false;
  });
});

document.querySelectorAll('[data-close-edit-product]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(`edit-product-row-${button.dataset.closeEditProduct}`).hidden = true;
  });
});

document.getElementById('buscarProdutoEstoque')?.addEventListener('input', (event) => {
  const termo = event.target.value.toLocaleLowerCase('pt-BR');
  document.querySelectorAll('[data-stock-row]').forEach((row) => {
    row.hidden = !row.textContent.toLocaleLowerCase('pt-BR').includes(termo);
  });
});

document.querySelectorAll('[data-deactivate-product]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm('Deseja desativar este produto?')) event.preventDefault();
  });
});
