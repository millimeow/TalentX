// Create gig page
renderNavbar('gigs');
initNavbarScroll();
initReveal();
requireAuth();

document.getElementById('gig-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/gigs', {
      method: 'POST',
      body: {
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        discipline: document.getElementById('discipline').value,
        city: document.getElementById('city').value,
        shootDate: document.getElementById('shootDate').value,
        budget: Number(document.getElementById('budget').value),
        peopleNeeded: Number(document.getElementById('peopleNeeded').value),
      },
    });
    toast('Gig published!', 'success');
    window.location.href = '/pages/dashboard.html?tab=gigs';
  } catch (err) {
    toast(err.message, 'error');
  }
});
