// Equipment board
renderNavbar('equipment');
initNavbarScroll();
initReveal();

const grid = document.getElementById('equipment-grid');
if (session.user) document.getElementById('list-gear-link').hidden = false;

function equipmentCard(e) {
  return `
    <a class="card hoverable" href="/pages/equipment-detail.html?id=${e.id}">
      ${e.imagePath ? `<img class="equip-img" src="/uploads/${e.imagePath}" alt="${escapeHtml(e.name)}">` : '<div class="equip-img" style="display:grid;place-items:center;font-size:2rem">🎥</div>'}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="chip">${e.category.toLowerCase()}</span>
        ${e.owner.plan === 'PRO' ? '<span class="badge PRO">PRO</span>' : ''}
      </div>
      <h3>${escapeHtml(e.name)}</h3>
      <div class="giver-row">
        ${avatarHtml(e.owner.name, e.owner.profile && e.owner.profile.photoPath, 24)}
        <span class="small muted">${escapeHtml(e.owner.name)} · ${escapeHtml(e.city)}</span>
      </div>
      <div class="price-row">
        <span class="price">${money(e.pricePerDay)}<span class="muted small">/day</span></span>
        <span class="muted small">deposit ${money(e.deposit)}</span>
      </div>
    </a>`;
}

async function loadEquipment() {
  const params = new URLSearchParams();
  const category = document.getElementById('f-category').value;
  const city = document.getElementById('f-city').value.trim();
  if (category) params.set('category', category);
  if (city) params.set('city', city);

  grid.innerHTML = '<div class="empty-state">Loading gear…</div>';
  try {
    const data = await api(`/equipment?${params.toString()}`);
    if (data.equipment.length === 0) {
      grid.innerHTML = '<div class="empty-state">No gear found for these filters.</div>';
      return;
    }
    grid.innerHTML = data.equipment.map(equipmentCard).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('filters').addEventListener('submit', (e) => {
  e.preventDefault();
  loadEquipment();
});

loadEquipment();
