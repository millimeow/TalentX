// Gig board with filters
renderNavbar('gigs');
initNavbarScroll();
initReveal();

const grid = document.getElementById('gig-grid');

function gigCard(gig) {
  return `
    <a class="card hoverable gig-card" href="/pages/gig-detail.html?id=${gig.id}">
      <div class="gig-top">
        <span class="chip">${escapeHtml(gig.discipline)}</span>
        <span class="badge ${gig.status}">${gig.status}</span>
      </div>
      <h3>${escapeHtml(gig.title)}</h3>
      <p class="muted small clamp">${escapeHtml(gig.description)}</p>
      <div class="giver-row">
        ${avatarHtml(gig.giver.name, null, 26)}
        <span class="small">${escapeHtml(gig.giver.name)}</span>
        ${gig.giver.plan === 'PRO' ? '<span class="badge PRO">PRO</span>' : ''}
        <span class="small">${stars(gig.giverRating)}</span>
      </div>
      <div class="meta-row">
        <span>📍 ${escapeHtml(gig.city)}</span>
        <span>📅 ${fmtDate(gig.shootDate)}</span>
        <span>👥 ${gig._count.applications} applied</span>
        <span class="budget">${money(gig.budget)}</span>
      </div>
    </a>`;
}

async function loadGigs() {
  const params = new URLSearchParams();
  const fields = { discipline: 'f-discipline', city: 'f-city', minBudget: 'f-min', maxBudget: 'f-max', minGiverRating: 'f-rating', status: 'f-status' };
  for (const [param, id] of Object.entries(fields)) {
    const value = document.getElementById(id).value.trim();
    if (value) params.set(param, value);
  }

  grid.innerHTML = '<div class="empty-state">Loading gigs…</div>';
  try {
    const data = await api(`/gigs?${params.toString()}`);
    if (data.gigs.length === 0) {
      grid.innerHTML = '<div class="empty-state">No gigs match these filters yet. Try clearing them, or post the first one.</div>';
      return;
    }
    grid.innerHTML = data.gigs.map(gigCard).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Could not load gigs: ${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('filters').addEventListener('submit', (e) => {
  e.preventDefault();
  loadGigs();
});

loadGigs();
