// Dashboard app shell: sidebar navigation, persona-aware overview and sections.
renderNavbar('dashboard');
initNavbarScroll();
requireAuth();

const content = document.getElementById('tab-content');
const me = session.user;
let persona = getPersona() === 'organizer' ? 'organizer' : 'talent';
let currentTab = new URLSearchParams(window.location.search).get('tab') || 'overview';

// keep the stored user fresh (wallet chip in the navbar)
refreshStoredUser().then(renderHeader);

// ---------- tiny inline icons (lucide-style strokes) ----------
const ICONS = {
  overview: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  gigs: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  applications: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/></svg>',
  contracts: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  rentals: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  wallet: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
  board: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  profile: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  admin: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
};

// ---------- header ----------
function renderHeader() {
  const u = session.user;
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting').textContent = `${timeGreeting}, ${u.name.split(' ')[0]}`;
  document.getElementById('dash-sub').textContent =
    persona === 'organizer'
      ? 'You are viewing as an Organizer — post gigs, hire and hold escrow.'
      : 'You are viewing as Talent — apply, deliver and get paid in two parts.';

  document.getElementById('dash-head-right').innerHTML = `
    ${personaSwitchHtml(persona)}
    <a class="wallet-chip" href="#" data-goto="wallet">&#9670; ${money(u.walletBalance)}</a>`;

  document.getElementById('side-persona').innerHTML = `
    <p class="muted small" style="padding:0 4px">Viewing as</p>
    ${personaSwitchHtml(persona)}`;

  // persona switch bindings (two copies, same behaviour)
  document.querySelectorAll('.persona-switch button').forEach((btn) => {
    btn.addEventListener('click', () => {
      persona = btn.dataset.persona;
      setPersona(persona);
      renderHeader();
      renderSidebar();
      loadTab();
    });
  });
  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); goToTab(el.dataset.goto); });
  });

  renderSidebar();
}

// ---------- sidebar ----------
function navItems() {
  const isOrganizer = persona === 'organizer';
  const items = [
    { id: 'overview', label: 'Overview', icon: ICONS.overview },
    isOrganizer
      ? { id: 'gigs', label: 'My gigs', icon: ICONS.gigs }
      : { id: 'applications', label: 'My applications', icon: ICONS.applications },
    isOrganizer
      ? { id: 'applications', label: 'Applicants in', icon: ICONS.applications }
      : { id: 'gigs', label: 'Gigs I applied to', icon: ICONS.gigs },
    { id: 'contracts', label: 'Contracts', icon: ICONS.contracts },
    { id: 'rentals', label: isOrganizer ? 'My gear rentals' : 'Rentals', icon: ICONS.rentals },
    { id: 'wallet', label: 'Wallet', icon: ICONS.wallet },
    { sep: true },
    { href: '/pages/gigs.html', label: 'Gig board', icon: ICONS.board, external: true },
    { href: '/pages/profile.html?id=' + me.id, label: 'My profile', icon: ICONS.profile, external: true },
  ];
  if (me.role === 'ADMIN') items.push({ href: '/pages/admin.html', label: 'Admin panel', icon: ICONS.admin, external: true });
  return items;
}

function renderSidebar() {
  const nav = document.getElementById('side-nav');
  nav.innerHTML = navItems().map((item) => {
    if (item.sep) return '<div class="sep"></div>';
    if (item.external) return `<a href="${item.href}">${item.icon}<span>${item.label}</span></a>`;
    return `<button data-tab="${item.id}" class="${currentTab === item.id ? 'active' : ''}">${item.icon}<span>${item.label}</span></button>`;
  }).join('');
  nav.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => goToTab(btn.dataset.tab));
  });
}

function goToTab(tab) {
  currentTab = tab;
  renderSidebar();
  loadTab();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- stats strip ----------
async function renderStats() {
  const strip = document.getElementById('stats-strip');
  try {
    const [wallet, contracts, mine, ratings] = await Promise.all([
      api('/wallet'),
      api('/contracts/mine'),
      api(persona === 'organizer' ? '/gigs?status=' : '/applications/mine'),
      api(`/users/${me.id}/ratings`),
    ]);
    const active = contracts.contracts.filter((c) => c.gig.status !== 'CANCELLED').length;
    const counts = persona === 'organizer'
      ? { posted: mine.gigs.filter((g) => g.giver.id === me.id).length }
      : { applied: mine.applications.length };
    const avg = ratings.average !== null && ratings.average !== undefined ? ratings.average.toFixed(1) : '—';

    strip.innerHTML = `
      <div class="stat-card"><span class="k">Wallet balance</span><span class="v maroon">${money(wallet.balance)}</span>
        <span class="x"><a href="#" data-goto="wallet">Add demo money / history →</a></span></div>
      <div class="stat-card"><span class="k">Active contracts</span><span class="v">${active}</span>
        <span class="x"><a href="#" data-goto="contracts">Open contracts →</a></span></div>
      ${persona === 'organizer'
        ? `<div class="stat-card"><span class="k">Gigs posted</span><span class="v">${counts.posted}</span>
             <span class="x"><a href="#" data-goto="gigs">Manage my gigs →</a></span></div>`
        : `<div class="stat-card"><span class="k">Applications sent</span><span class="v">${counts.applied}</span>
             <span class="x"><a href="#" data-goto="applications">Track applications →</a></span></div>`}
      <div class="stat-card"><span class="k">Average rating</span><span class="v">${avg}</span>
        <span class="x"><a href="/pages/profile.html?id=${me.id}">See my profile ↗</a></span></div>`;
  } catch {
    strip.innerHTML = '';
  }
  strip.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); goToTab(el.dataset.goto); });
  });
}

// ---------- overview ----------
async function renderOverview() {
  const isOrganizer = persona === 'organizer';
  const wallet = await api('/wallet');
  const recent = wallet.transactions.slice(0, 6);

  const actions = isOrganizer ? [
    { emoji: '📣', label: 'Post a new gig', sub: 'Free plan: 3 posts per month', href: '/pages/create-gig.html' },
    { emoji: '🗂️', label: 'Review applicants', sub: 'Accept one, upload the contract PDF', tab: 'gigs' },
    { emoji: '💰', label: 'Add demo money', sub: 'Top up the demo wallet to fund escrow', tab: 'wallet' },
    { emoji: '⭐', label: 'Upgrade to PRO', sub: 'Unlimited posts, verified badge, priority', href: '/pages/pricing.html' },
  ] : [
    { emoji: '🔎', label: 'Browse the gig board', sub: 'Filter by discipline, city and budget', href: '/pages/gigs.html' },
    { emoji: '📨', label: 'Track applications', sub: 'See where you stand', tab: 'applications' },
    { emoji: '💰', label: 'Add demo money', sub: 'Wallet top-up for escrowed contracts', tab: 'wallet' },
    { emoji: '🧾', label: 'How payouts work', sub: '50% after the shoot, 50% on approval', href: '/pages/about.html' },
  ];

  content.innerHTML = `
    <div class="quick-actions">
      ${actions.map((a, i) => `
        <button class="quick-action" data-href="${a.href || ''}" data-tab="${a.tab || ''}">
          <span class="qa-emoji">${a.emoji}</span>
          <strong>${a.label}</strong>
          <span>${a.sub}</span>
        </button>`).join('')}
    </div>
    <div class="card" style="margin-top:18px">
      <h3>Recent wallet activity</h3>
      ${recent.length === 0 ? '<p class="muted">Nothing yet — your top-ups, escrow and payouts will appear here.</p>' : `
      <div class="table-wrap"><table>
        <tbody>${recent.map((tx) => `
          <tr>
            <td class="muted small">${new Date(tx.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
            <td><span class="chip outline">${tx.type}</span></td>
            <td class="small">${escapeHtml(tx.description || '')}</td>
            <td style="text-align:right" class="${tx.amount >= 0 ? 'tx-in' : 'tx-out'}">${tx.amount >= 0 ? '+' : ''}${money(tx.amount)}</td>
          </tr>`).join('')}</tbody>
      </table></div>`}
    </div>`;

  content.querySelectorAll('.quick-action').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.href) window.location.href = btn.dataset.href;
      else if (btn.dataset.tab) goToTab(btn.dataset.tab);
    });
  });
}

// ---------- sections (persona-labelled) ----------
async function renderMyGigs() {
  const data = await api('/gigs?status=');
  const mine = data.gigs.filter((g) => g.giver.id === me.id);
  if (mine.length === 0) {
    content.innerHTML = '<div class="empty-state">You have not posted any gigs yet. <a href="/pages/create-gig.html">Post one →</a></div>';
    return;
  }
  content.innerHTML = `<div class="stack-cards">${mine.map((g) => `
    <div class="card hoverable">
      <div class="rental-head">
        <div><span class="badge ${g.status}">${g.status}</span> <a href="/pages/gig-detail.html?id=${g.id}"><strong>${escapeHtml(g.title)}</strong></a></div>
        <div class="meta-row"><span>${money(g.budget)}</span><span>📍 ${escapeHtml(g.city)}</span><span>📅 ${fmtDate(g.shootDate)}</span><span>👥 ${g._count.applications} applied</span></div>
      </div>
      ${g.contract ? `<a class="btn ghost sm" href="/pages/contract.html?id=${g.contract.id}">Open contract #${g.contract.id}</a>` : ''}
    </div>`).join('')}</div>`;
}

async function renderApplications() {
  const data = await api('/applications/mine');
  if (data.applications.length === 0) {
    content.innerHTML = '<div class="empty-state">You have not applied to any gigs. <a href="/pages/gigs.html">Browse the board →</a></div>';
    return;
  }
  content.innerHTML = `<div class="stack-cards">${data.applications.map((a) => `
    <div class="card hoverable">
      <div class="rental-head">
        <div><span class="badge ${a.status}">${a.status}</span> <a href="/pages/gig-detail.html?id=${a.gig.id}"><strong>${escapeHtml(a.gig.title)}</strong></a></div>
        <div class="meta-row"><span>${money(a.gig.budget)}</span><span>📍 ${escapeHtml(a.gig.city)}</span><span>📅 ${fmtDate(a.gig.shootDate)}</span><span class="muted small">applied ${fmtDate(a.createdAt)}</span></div>
      </div>
    </div>`).join('')}</div>`;
}

async function renderContracts() {
  const data = await api('/contracts/mine');
  if (data.contracts.length === 0) {
    content.innerHTML = '<div class="empty-state">No contracts yet. They appear here once an applicant is hired.</div>';
    return;
  }
  content.innerHTML = `<div class="stack-cards">${data.contracts.map((c) => {
    const iAmGiver = c.giver.id === me.id;
    const other = iAmGiver ? c.taker : c.giver;
    const held = c.payment ? c.payment.heldAmount : 0;
    const released = c.payment ? c.payment.releasedAmount : 0;
    return `
    <div class="card hoverable">
      <div class="rental-head">
        <div><span class="badge ${c.gig.status}">${c.gig.status}</span> <a href="/pages/contract.html?id=${c.id}"><strong>Contract #${c.id}</strong></a> <span class="muted small">— ${escapeHtml(c.gig.title)}</span></div>
        <span class="muted small">${iAmGiver ? 'taker' : 'giver'}: <a href="/pages/profile.html?id=${other.id}">${escapeHtml(other.name)}</a></span>
      </div>
      <div class="meta-row">
        <span>${money(c.amount)}</span>
        <span>escrow: ${money(released)}/${money(held)} released</span>
        <span class="small muted">${c.takerAccepted ? '✔ accepted' : '⏳ waiting for acceptance'} · ${c.depositPaid ? '✔ funded' : '⏳ not funded'}</span>
      </div>
      <a class="btn ghost sm" href="/pages/contract.html?id=${c.id}">Open contract →</a>
    </div>`;
  }).join('')}</div>`;
}

function rentalCard(r) {
  const iAmOwner = r.equipment.owner.id === me.id;
  const other = iAmOwner ? r.renter : r.equipment.owner;
  const days = Math.max(1, Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000));
  const total = (r.rentAmount || 0) + (r.depositAmount || 0);

  let next = '';
  if (r.status === 'PENDING') {
    next = iAmOwner
      ? `<button class="btn sm" data-agree="${r.id}">Approve + upload agreement PDF</button>`
      : '<span class="small muted">Waiting for the owner to approve and upload the agreement.</span>';
  } else if (r.status === 'APPROVED') {
    next = iAmOwner
      ? '<span class="small muted">Waiting for the renter to sign &amp; pay into escrow.</span>'
      : `<button class="btn sm" data-pay="${r.id}">Accept agreement &amp; pay ${money(total)} (rent ${money(r.rentAmount)} + deposit ${money(r.depositAmount)})</button>`;
  } else if (r.status === 'ACTIVE') {
    next = `
      <details><summary class="small" style="cursor:pointer">Add inspection (condition note, score 1–5, photo)</summary>
        <form class="rate-inline" data-insp="${r.id}">
          <div class="form-row">
            <div><label>Type</label><select name="type"><option value="PRE">PRE (before)</option><option value="POST">POST (after return)</option></select></div>
            <div><label>Condition score</label><select name="conditionScore">${[5,4,3,2,1].map((n) => `<option>${n}</option>`).join('')}</select></div>
          </div>
          <div><label>Note</label><input name="note" placeholder="Scratches, missing items…"></div>
          <div><label>Photo</label><input type="file" name="photo" accept="image/*"></div>
          <button class="btn sm" type="submit">Save inspection</button>
        </form>
      </details>
      ${iAmOwner ? `<button class="btn sm" data-return="${r.id}">Confirm return in good condition (rent ${money(r.rentAmount)} to you, deposit ${money(r.depositAmount)} back)</button>
                    <button class="btn danger sm" data-dispute="${r.id}">Gear was damaged — dispute</button>`
                 : '<span class="small muted">Waiting for the owner to confirm the return.</span>'}`;
  } else if (r.status === 'RETURNED') {
    next = `<details><summary class="small" style="cursor:pointer">⭐ Rate ${escapeHtml(other.name)}</summary>
      <form class="rate-inline" data-rate="${r.id}" data-other="${other.id}">
        <div class="form-row">
          <div><label>Professionalism</label><select name="professionalism">${[5,4,3,2,1].map((n) => `<option>${n}</option>`).join('')}</select></div>
          <div><label>Punctuality</label><select name="punctuality">${[5,4,3,2,1].map((n) => `<option>${n}</option>`).join('')}</select></div>
        </div>
        <div class="form-row">
          <div><label>Quality</label><select name="quality">${[5,4,3,2,1].map((n) => `<option>${n}</option>`).join('')}</select></div>
          <div><label>Communication</label><select name="communication">${[5,4,3,2,1].map((n) => `<option>${n}</option>`).join('')}</select></div>
        </div>
        <div><label>Equipment care</label><select name="equipmentCare">${[5,4,3,2,1].map((n) => `<option>${n}</option>`).join('')}</select></div>
        <div><label>Comment</label><input name="comment"></div>
        <button class="btn sm" type="submit">Submit rating</button>
      </form></details>`;
  }

  const inspections = (r.inspections || []).map((i) => `
    <div class="insp-row">
      ${i.photoPath ? `<img src="${escapeHtml(fileUrl(i.photoPath))}" alt="">` : ''}
      <span class="badge ${i.type === 'PRE' ? 'PENDING' : 'HIRED'}">${i.type}</span>
      <span>score ${i.conditionScore}/5 — ${escapeHtml(i.note || 'no note')}</span>
      <span class="small">by ${escapeHtml(i.byUser.name)}</span>
    </div>`).join('');

  return `
    <div class="card hoverable rental-card" data-rental="${r.id}">
      <div class="rental-head">
        <div><span class="badge ${r.status}">${r.status}</span> <strong>${escapeHtml(r.equipment.name)}</strong></div>
        <span class="muted small">${iAmOwner ? 'renter' : 'owner'}: <a href="/pages/profile.html?id=${other.id}">${escapeHtml(other.name)}</a></span>
      </div>
      <div class="meta-row">
        <span>📅 ${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}</span>
        <span>${days} day(s)</span>
        ${r.rentAmount ? `<span>rent ${money(r.rentAmount)} · deposit ${money(r.depositAmount)}</span>` : `<span class="muted small">${money(r.equipment.pricePerDay)}/day</span>`}
        ${r.payment ? `<span class="badge ${r.payment.status}">escrow ${r.payment.status}</span>` : ''}
      </div>
      ${r.agreementPdfPath ? `<a class="small" href="#" data-agree-pdf="${r.id}">📄 Rental agreement PDF</a>` : ''}
      ${inspections}
      ${next}
    </div>`;
}

async function renderRentals() {
  const data = await api('/rentals');
  if (data.rentals.length === 0) {
    content.innerHTML = '<div class="empty-state">No rentals yet. <a href="/pages/equipment.html">Browse gear →</a></div>';
    return;
  }
  content.innerHTML = `<div class="stack-cards">${data.rentals.map((r) => rentalCard(r)).join('')}</div>`;
  bindRentalActions();
}

function bindRentalActions() {
  content.querySelectorAll('[data-agree]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = async () => {
        const fd = new FormData();
        fd.append('agreement', input.files[0], input.files[0].name);
        try {
          await api(`/rentals/${btn.dataset.agree}/approve`, { method: 'POST', formData: fd });
          toast('Rental approved — agreement uploaded. The renter can now pay.', 'success');
          loadTab();
        } catch (err) { toast(err.message, 'error'); }
      };
      input.click();
    });
  });

  content.querySelectorAll('[data-pay]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/rentals/${btn.dataset.pay}/sign-and-pay`, { method: 'POST' });
        toast('Paid into escrow — rental is now active.', 'success');
        await refreshStoredUser();
        renderHeader();
        loadTab();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  content.querySelectorAll('[data-insp]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rentalId = form.dataset.insp;
      const fd = new FormData(form);
      const payload = new FormData();
      payload.append('type', fd.get('type'));
      payload.append('conditionScore', fd.get('conditionScore'));
      payload.append('note', fd.get('note'));
      const photo = form.querySelector('input[type="file"]').files[0];
      if (photo) payload.append('photo', photo, photo.name);
      try {
        await api(`/rentals/${rentalId}/inspection`, { method: 'POST', formData: payload });
        toast('Inspection saved.', 'success');
        loadTab();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  content.querySelectorAll('[data-return]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/rentals/${btn.dataset.return}/return`, { method: 'POST' });
        toast('Return confirmed — rent released to you, deposit refunded.', 'success');
        await refreshStoredUser();
        renderHeader();
        loadTab();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  content.querySelectorAll('[data-dispute]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const reason = prompt('Describe the damage — the admin will read this and the inspections:');
      if (!reason) return;
      api(`/rentals/${btn.dataset.dispute}/dispute`, { method: 'POST', body: { reason } })
        .then(() => { toast('Dispute raised — escrow frozen.', 'success'); loadTab(); })
        .catch((err) => toast(err.message, 'error'));
    });
  });

  content.querySelectorAll('[data-rate]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await api('/ratings', {
          method: 'POST',
          body: {
            rentalId: Number(form.dataset.rate),
            toUserId: Number(form.dataset.other),
            professionalism: Number(fd.get('professionalism')),
            punctuality: Number(fd.get('punctuality')),
            quality: Number(fd.get('quality')),
            communication: Number(fd.get('communication')),
            equipmentCare: Number(fd.get('equipmentCare')),
            comment: fd.get('comment') || undefined,
          },
        });
        toast('Thanks for rating!', 'success');
        loadTab();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  content.querySelectorAll('[data-agree-pdf]').forEach((link) => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(`${API_BASE}/rentals/${link.dataset.agreePdf}/agreement`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        if (!res.ok) throw new Error('Could not open the agreement PDF.');
        const blob = await res.blob();
        window.open(URL.createObjectURL(blob), '_blank');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
}

async function renderWallet() {
  const data = await api('/wallet');
  content.innerHTML = `
    <div class="card" style="margin-bottom:18px">
      <div class="rental-head">
        <div><div class="k muted small" style="text-transform:uppercase;letter-spacing:.05em;font-size:.74rem">Balance (demo money)</div>
          <div style="font-size:2rem;font-weight:800;color:var(--accent)">${money(data.balance)}</div></div>
        <form id="topup-form" style="display:flex;gap:8px;align-items:flex-end">
          <div><label for="topup-amount">Amount</label><input id="topup-amount" type="number" min="1" value="10000" style="width:130px"></div>
          <button class="btn" type="submit">Add demo money</button>
        </form>
      </div>
    </div>
    <div class="card">
      <h3>Transaction history</h3>
      ${data.transactions.length === 0 ? '<p class="muted">No transactions yet.</p>' : `
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          ${data.transactions.map((tx) => `
            <tr>
              <td class="muted small">${new Date(tx.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td><span class="chip outline">${tx.type}</span></td>
              <td class="small">${escapeHtml(tx.description || '')} ${tx.referenceId ? `<span class="muted">(${escapeHtml(tx.referenceId)})</span>` : ''}</td>
              <td style="text-align:right" class="${tx.amount >= 0 ? 'tx-in' : 'tx-out'}">${tx.amount >= 0 ? '+' : ''}${money(tx.amount)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>`}
    </div>`;

  document.getElementById('topup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/wallet/topup', { method: 'POST', body: { amount: Number(document.getElementById('topup-amount').value) } });
      await refreshStoredUser();
      renderHeader();
      toast('Demo money added!', 'success');
      loadTab();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ---------- tab dispatch ----------
async function loadTab() {
  content.innerHTML = '<div class="empty-state">Loading…</div>';
  renderStats();
  try {
    if (currentTab === 'overview') await renderOverview();
    else if (currentTab === 'gigs') await renderMyGigs();
    else if (currentTab === 'applications') await renderApplications();
    else if (currentTab === 'contracts') await renderContracts();
    else if (currentTab === 'rentals') await renderRentals();
    else await renderWallet();
  } catch (err) {
    content.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

renderHeader();
loadTab();
