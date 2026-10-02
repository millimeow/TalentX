// Public profile page + edit tools when viewing your own profile
renderNavbar();
initNavbarScroll();
initReveal();

const userId = Number(getParam('id')) || (session.user && session.user.id);
const box = document.getElementById('profile-detail');
const tools = document.getElementById('own-tools');
const isMe = session.user && session.user.id === userId;

async function loadProfile() {
  try {
    const data = await api(`/users/${userId}`);
    const p = data.profile || {};
    box.innerHTML = `
      <div class="card">
        <div class="profile-head">
          ${data.profile && data.profile.photoPath
            ? `<img src="${escapeHtml(fileUrl(data.profile.photoPath))}" class="avatar" style="width:76px;height:76px;border-radius:50%">`
            : `<span class="avatar" style="width:76px;height:76px;font-size:1.4rem">${escapeHtml(initials(data.user.name))}</span>`}
          <div class="info">
            <h1>${escapeHtml(data.user.name)} ${data.user.plan === 'PRO' ? '<span class="badge PRO">PRO</span>' : ''}</h1>
            <div class="meta-row">
              <span>${p.discipline ? escapeHtml(p.discipline) : 'creator'}</span>
              ${p.city ? `<span>📍 ${escapeHtml(p.city)}</span>` : ''}
              <span>${stars(data.averageRating)} <span class="muted">(${data.ratingsCount} ratings)</span></span>
              ${data.flaggedForReview ? '<span class="badge DISPUTED">flagged for review</span>' : ''}
            </div>
          </div>
        </div>
        <div class="profile-facts">
          ${p.dayRate ? `<div class="fact"><div class="k">Day rate</div><div class="v">${money(p.dayRate)}</div></div>` : ''}
          <div class="fact"><div class="k">Member since</div><div class="v">${fmtDate(data.user.createdAt)}</div></div>
        </div>
        ${p.bio ? `<hr class="divider"><p>${escapeHtml(p.bio)}</p>` : ''}
        ${p.credits ? `<hr class="divider"><div class="k muted small">PAST CREDITS</div><p class="small">${escapeHtml(p.credits)}</p>` : ''}
        ${p.gearList ? `<hr class="divider"><div class="k muted small">GEAR</div><p class="small">${escapeHtml(p.gearList)}</p>` : ''}
      </div>`;

    await loadPortfolio();
    if (isMe) renderTools(p);
  } catch (err) {
    box.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function loadPortfolio() {
  let items = [];
  try {
    const data = await api(`/users/${userId}/portfolio`);
    items = data.items;
  } catch { /* ignore */ }

  const section = document.createElement('section');
  section.innerHTML = `<h2 style="margin:22px 0 12px">Portfolio</h2>`;
  if (items.length === 0) {
    section.innerHTML += '<div class="empty-state">No portfolio items yet.</div>';
  } else {
    section.innerHTML += `<div class="portfolio-grid">
      ${items.map((item) => `
        <div class="portfolio-item">
          ${item.type === 'PHOTO' && item.filePath
            ? `<img src="${escapeHtml(fileUrl(item.filePath))}" alt="${escapeHtml(item.title)}">`
            : `<div style="height:140px;display:grid;place-items:center;background:var(--accent-soft);font-size:2rem">🎬</div>`}
          <div class="body">
            <span class="small">${item.type === 'VIDEO' ? `<a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title)}</a>` : escapeHtml(item.title)}</span>
            ${isMe ? `<button class="btn danger sm" data-del="${item.id}">✕</button>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
  }
  box.appendChild(section);

  section.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/portfolio/${btn.dataset.del}`, { method: 'DELETE' });
        toast('Portfolio item removed.', 'success');
        box.innerHTML = '';
        tools.innerHTML = '';
        loadProfile();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

function renderTools(p) {
  tools.hidden = false;
  tools.innerHTML = `
    <div class="card">
      <h3>Edit your profile</h3>
      <form id="edit-form" class="form-grid">
        <div class="form-row">
          <div><label for="e-discipline">Discipline</label>
            <select id="e-discipline">
              <option value="">—</option>
              ${['photographer', 'cinematographer', 'model', 'director', 'editor', 'lighting', 'costume', 'other'].map((d) => `<option ${p.discipline === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select></div>
          <div><label for="e-city">City</label><input id="e-city" value="${escapeHtml(p.city || '')}"></div>
        </div>
        <div class="form-row">
          <div><label for="e-dayrate">Day rate (₹)</label><input id="e-dayrate" type="number" min="0" value="${p.dayRate || ''}"></div>
          <div><label for="e-photo">Profile photo</label><input id="e-photo" type="file" accept="image/*"></div>
        </div>
        <div><label for="e-bio">Bio</label><textarea id="e-bio">${escapeHtml(p.bio || '')}</textarea></div>
        <div><label for="e-credits">Past credits</label><textarea id="e-credits" style="min-height:60px">${escapeHtml(p.credits || '')}</textarea></div>
        <div><label for="e-gear">Gear list</label><input id="e-gear" value="${escapeHtml(p.gearList || '')}" placeholder="Sony A7IV, 85mm…"></div>
        <button class="btn" type="submit">Save profile</button>
      </form>
    </div>
    <div class="card">
      <h3>Add portfolio item</h3>
      <form id="portfolio-form" class="form-grid">
        <div class="form-row">
          <div><label for="pf-title">Title</label><input id="pf-title" required></div>
          <div><label for="pf-file">Photo (up to 5 MB)</label><input id="pf-file" type="file" accept="image/*"></div>
        </div>
        <div><label for="pf-url">…or a video link (YouTube / Drive)</label><input id="pf-url" type="url" placeholder="https://www.youtube.com/watch?v=…"></div>
        <button class="btn" type="submit">Add to portfolio</button>
      </form>
    </div>`;

  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/profile/me', {
        method: 'PUT',
        body: {
          discipline: document.getElementById('e-discipline').value || null,
          city: document.getElementById('e-city').value || null,
          bio: document.getElementById('e-bio').value || null,
          dayRate: document.getElementById('e-dayrate').value ? Number(document.getElementById('e-dayrate').value) : null,
          credits: document.getElementById('e-credits').value || null,
          gearList: document.getElementById('e-gear').value || null,
        },
      });
      toast('Profile saved.', 'success');
      reloadPage();
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('e-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('photo', file, file.name);
    try {
      await api('/profile/me/photo', { method: 'POST', formData: fd });
      toast('Photo updated.', 'success');
      await refreshStoredUser();
      reloadPage();
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('portfolio-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('title', document.getElementById('pf-title').value);
    const file = document.getElementById('pf-file').files[0];
    const url = document.getElementById('pf-url').value.trim();
    if (file) fd.append('photo', file, file.name);
    else if (url) fd.append('url', url);
    try {
      await api('/portfolio', { method: 'POST', formData: fd });
      toast('Portfolio item added.', 'success');
      reloadPage();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function reloadPage() {
  box.innerHTML = '';
  tools.innerHTML = '';
  tools.hidden = true;
  loadProfile();
}

loadProfile();
