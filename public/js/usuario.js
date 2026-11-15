document.querySelector('[data-delete-operational-data]')?.addEventListener('submit', (event) => {
  if (!window.confirm('Confirma a exclusão permanente de todos os registros de estoque, suprimentos e requisições?')) {
    event.preventDefault();
  }
});
