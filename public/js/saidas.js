document.querySelectorAll('[data-withdrawal-form]').forEach((form) => {
  const dialog = form.parentElement.querySelector('[data-withdrawal-dialog]');
  const select = dialog.querySelector('[data-withdrawal-select]');
  const quantity = dialog.querySelector('[data-withdrawal-quantity]');
  const list = form.querySelector('[data-withdrawal-list]');
  const emptyMessage = form.querySelector('[data-withdrawal-empty]');
  const itemsInput = form.querySelector('[data-withdrawal-items]');
  const submitButton = form.querySelector('[data-submit-withdrawal]');
  const items = [];

  const renderItems = () => {
    list.replaceChildren();
    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'request-item-row';
      const name = document.createElement('strong');
      name.textContent = item.nome;
      const amount = document.createElement('span');
      amount.textContent = `Quantidade: ${item.quantidade}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button-danger';
      remove.textContent = 'Remover';
      remove.addEventListener('click', () => {
        items.splice(index, 1);
        renderItems();
      });
      row.append(name, amount, remove);
      list.append(row);
    });

    itemsInput.value = JSON.stringify(items.map(({ id, quantidade }) => ({ id, quantidade })));
    emptyMessage.hidden = items.length > 0;
    submitButton.disabled = items.length === 0;
  };

  form.querySelector('[data-open-withdrawal-dialog]')?.addEventListener('click', () => {
    select.value = '';
    quantity.value = '1';
    dialog.showModal();
    select.focus();
  });

  dialog.querySelector('[data-add-withdrawal-item]')?.addEventListener('click', () => {
    if (!select.reportValidity() || !quantity.reportValidity()) return;
    const option = select.selectedOptions[0];
    items.push({
      id: select.value,
      nome: option.dataset.name,
      quantidade: Number(quantity.value)
    });
    renderItems();
    dialog.close();
  });

  dialog.querySelector('[data-close-withdrawal-dialog]')?.addEventListener('click', () => {
    dialog.close();
  });
});
