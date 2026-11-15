document.querySelector('[data-delete-operational-data]')?.addEventListener('submit', (event) => {
  if (!window.confirm('Confirma a exclusão permanente de todos os registros de estoque, suprimentos e requisições?')) {
    event.preventDefault();
  }
});

document.querySelectorAll('[data-edit-user]').forEach((button) => {
  button.addEventListener('click', () => {
    const editRow = document.getElementById(`edit-user-${button.dataset.editUser}`);
    const shouldOpen = editRow.hidden;

    document.querySelectorAll('[data-user-edit-row]').forEach((row) => {
      row.hidden = true;
    });
    document.querySelectorAll('[data-edit-user]').forEach((editButton) => {
      editButton.setAttribute('aria-expanded', 'false');
    });

    editRow.hidden = !shouldOpen;
    button.setAttribute('aria-expanded', String(shouldOpen));
  });
});

document.querySelectorAll('[data-close-user]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(`edit-user-${button.dataset.closeUser}`).hidden = true;
    document.querySelector(`[data-edit-user="${button.dataset.closeUser}"]`)
      ?.setAttribute('aria-expanded', 'false');
  });
});

document.getElementById('buscarUsuario')?.addEventListener('input', (event) => {
  const termo = event.target.value.toLowerCase();
  document.querySelectorAll('[data-user-row]').forEach((row) => {
    const corresponde = row.textContent.toLowerCase().includes(termo);
    row.hidden = !corresponde;
    if (!corresponde && row.nextElementSibling?.matches('[data-user-edit-row]')) {
      row.nextElementSibling.hidden = true;
      row.querySelector('[data-edit-user]')?.setAttribute('aria-expanded', 'false');
    }
  });
});
