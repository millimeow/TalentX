// Equipment detail + rental request
renderNavbar('equipment');
initNavbarScroll();

const equipmentId = Number(getParam('id'));
const box = document.getElementById('equipment-detail');
const me = session.user;
let equipment = null;

async function loadEquipment() {
  try {
    const data = await api(`/equipment/${equipmentId}`);
    equipment = data.equipment;
    render();
  } catch (err) {
    box.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function estimate() {
  const start = new Date(document.getElementById('r-start').value);
  const end = new Date(document.getElementById('r-end').value);
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  const days = Math.max(1, Math.ceil((end - start) / 86400000));
  return { days, rent: equipment.pricePerDay * days, deposit: equipment.deposit, total: equipment.pricePerDay * days + equipment.deposit };
}

function render() {
  const isOwner = me && me.id === equipment.ownerId;
  box.innerHTML = `
    <div class="card">
      ${equipment.imagePath ? `<img class="equip-img" src="${escapeHtml(fileUrl(equipment.imagePath))}" alt="${escapeHtml(equipment.name)}">` : ''}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="chip">${equipment.category.toLowerCase()}</span>
        <span class="muted small">listed by <a href="/pages/profile.html?id=${equipment.owner.id}">${escapeHtml(equipment.owner.name)}</a> · 📍 ${escapeHtml(equipment.city)}</span>
      </div>
      <h1>${escapeHtml(equipment.name)}</h1>
      <div class="detail-meta">
        <div class="box"><div class="k">Price</div><div class="v">${money(equipment.pricePerDay)}/day</div></div>
        <div class="box"><div class="k">Deposit (refundable)</div><div class="v">${money(equipment.deposit)}</div></div>
      </div>
      ${equipment.description ? `<p>${escapeHtml(equipment.description)}</p>` : ''}
    </div>

    <div class="card" style="margin-top:18px" id="rental-box">
      <h3>Request a booking</h3>
      ${!me ? `<p class="muted"><a href="/pages/login.html">Log in</a> to request dates.</p>` :
        isOwner ? '<p class="muted">This is your listing — requests appear in your <a href="/pages/dashboard.html?tab=rentals">dashboard</a>.</p>' : `
        <form id="rental-form" class="form-grid">
          <div class="form-row">
            <div><label for="r-start">Start date</label><input id="r-start" type="date" required></div>
            <div><label for="r-end">End date</label><input id="r-end" type="date" required></div>
          </div>
          <p class="small muted" id="r-estimate">Pick dates to see the estimate — rent plus deposit is paid into escrow only after the owner approves and uploads the agreement.</p>
          <button class="btn" type="submit">Request dates</button>
        </form>`}
    </div>`;

  const form = document.getElementById('rental-form');
  if (form) {
    const estimateEl = document.getElementById('r-estimate');
    const update = () => {
      const est = estimate();
      estimateEl.textContent = est
        ? `${est.days} day(s): rent ${money(est.rent)} + deposit ${money(est.deposit)} = ${money(est.total)} total (held in escrow)`
        : 'Pick dates to see the estimate — rent plus deposit is paid into escrow only after the owner approves and uploads the agreement.';
    };
    document.getElementById('r-start').addEventListener('change', update);
    document.getElementById('r-end').addEventListener('change', update);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/rentals', {
          method: 'POST',
          body: { equipmentId, startDate: document.getElementById('r-start').value, endDate: document.getElementById('r-end').value },
        });
        toast('Request sent — the owner will approve and upload the rental agreement.', 'success');
        window.location.href = '/pages/dashboard.html?tab=rentals';
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }
}

loadEquipment();
