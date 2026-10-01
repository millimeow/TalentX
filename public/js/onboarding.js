// Persona onboarding — shown once after login (skippable, switchable later)
renderNavbar();
initNavbarScroll();
if (requireAuth()) {
  document.querySelectorAll('.choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPersona(btn.dataset.persona);
      toast(`Viewing as ${btn.dataset.persona === 'talent' ? 'Talent' : 'Organizer'} — switch any time.`, 'success');
      window.location.href = '/pages/dashboard.html';
    });
  });
}
