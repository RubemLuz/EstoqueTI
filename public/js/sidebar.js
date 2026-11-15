const appShell = document.getElementById('appShell');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const mobileMenuButton = document.getElementById('mobileMenuButton');
const loginModal = document.getElementById('loginModal');

function setMenu(open) {
  appShell.classList.toggle('sidebar-collapsed', !open);
  sidebar.classList.toggle('open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
}

menuToggle.addEventListener('click', () => {
  setMenu(appShell.classList.contains('sidebar-collapsed'));
});

mobileMenuButton.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

function closeMobileMenu() {
  if (window.innerWidth <= 760) {
    sidebar.classList.remove('open');
  }
}

document.querySelectorAll('.menu-link').forEach((link) => {
  link.addEventListener('click', closeMobileMenu);
});

document.getElementById('accountButton').addEventListener('click', () => {
  window.location.href = '/usuario';
});
