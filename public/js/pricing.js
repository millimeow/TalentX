// Pricing page — plan state + demo upgrade/downgrade
renderNavbar('pricing');
initNavbarScroll();
initReveal();

const proBtn = document.getElementById('pro-btn');
const freeBtn = document.getElementById('free-btn');

function paint(plan) {
  const isPro = plan === 'PRO';
  proBtn.innerHTML = isPro
    ? 'You\u2019re on PRO \u2713'
    : 'Go PRO <span class="arrow">&rarr;</span>';
  proBtn.disabled = isPro;
  proBtn.classList.toggle('secondary', isPro);
  freeBtn.innerHTML = isPro ? 'Switch back to Free' : 'You\u2019re on this plan \u2713';
  freeBtn.disabled = !isPro;
}

(async () => {
  if (session.user) {
    await refreshStoredUser();
    paint(session.user.plan);
  } else {
    proBtn.addEventListener('click', () => {
      toast('Create an account first — it takes 20 seconds.', 'error');
      window.location.href = '/pages/login.html?mode=register';
    });
    freeBtn.disabled = true;
    freeBtn.textContent = 'Log in to see your plan';
  }
})();

proBtn.addEventListener('click', async () => {
  if (!requireAuth()) return;
  try {
    const data = await api('/plans/upgrade', { method: 'POST' });
    session.save({ user: data.user, accessToken: session.accessToken, refreshToken: session.refreshToken });
    toast(data.message, 'success');
    renderNavbar('pricing');
    paint('PRO');
  } catch (err) { toast(err.message, 'error'); }
});

freeBtn.addEventListener('click', async () => {
  if (!requireAuth()) return;
  try {
    const data = await api('/plans/downgrade', { method: 'POST' });
    session.save({ user: data.user, accessToken: session.accessToken, refreshToken: session.refreshToken });
    toast(data.message, 'success');
    renderNavbar('pricing');
    paint('FREE');
  } catch (err) { toast(err.message, 'error'); }
});
