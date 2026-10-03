// Gig board with filters
renderNavbar('gigs');
initNavbarScroll();
initReveal();

const grid = document.getElementById('gig-grid');

// Organizer manages their own gigs across statuses — default the filter to All.
if (session.user && getPersona() === 'organizer') {
  document.getElementById('f-status').value = '';
}

// Switching persona re-categorises the board
function applyPersonaBoardDefaults() {
  if (session.user && getPersona() === 'organizer') document.getElementById('f-status').value = '';
}
window.addEventListener('persona-changed', () => {
  applyPersonaBoardDefaults();
  loadGigs();
});

function gigCard(gig) {
  return `
    <a class="card hoverable gig-card" href="/pages/gig-detail.html?id=${gig.id}">
      <div class="gig-top">
        <span class="chip">${escapeHtml(gig.discipline)}</span>
        <span class="badge ${gig.status}">${gig.status}</span>
      </div>
      <h3 class="gig-title">${escapeHtml(gig.title)}</h3>
      <p class="muted small clamp">${escapeHtml(gig.description)}</p>
      <div class="giver-row">
        ${avatarHtml(gig.giver.name, null, 26)}
        <span class="small g-name">${escapeHtml(gig.giver.name)}</span>
        ${gig.giver.plan === 'PRO' ? '<span class="badge PRO">PRO</span>' : ''}
        <span class="small stars-inline">${stars(gig.giverRating)}</span>
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
  const noticeEl = document.getElementById('board-notice');
  try {
    const data = await api(`/gigs?${params.toString()}`);
    let gigs = data.gigs;

    // The board follows the persona: organizers manage their own postings,
    // talent browses everyone else's work.
    const me = session.user;
    const persona = getPersona() === 'organizer' ? 'organizer' : 'talent';
    if (me && persona === 'organizer') {
      gigs = gigs.filter((g) => g.giver.id === me.id);
    } else if (me && persona === 'talent') {
      gigs = gigs.filter((g) => g.giver.id !== me.id);
    }

    if (gigs.length === 0) {
      grid.innerHTML = (me && persona === 'organizer')
        ? '<div class="empty-state">You haven\'t posted any gigs yet. <a href="/pages/create-gig.html">Post one →</a></div>'
        : '<div class="empty-state">No gigs match these filters yet. Try clearing them, or check back soon.</div>';
      return;
    }
    grid.innerHTML = gigs.map(gigCard).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Could not load gigs: ${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('filters').addEventListener('submit', (e) => {
  e.preventDefault();
  loadGigs();
});

loadGigs();
