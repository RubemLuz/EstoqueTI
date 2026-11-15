const filialSelecionada = document.getElementById('filialSelecionada');

if (filialSelecionada) {
  filialSelecionada.addEventListener('change', (event) => {
    const url = new URL(window.location.href);
    url.searchParams.set('filial', event.target.value);
    window.location.href = url.toString();
  });
}
