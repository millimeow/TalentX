// Gig detail: info, apply (taker), applicants + accept + create contract (giver)
renderNavbar('gigs');
initNavbarScroll();
initReveal();

const gigId = Number(getParam('id'));
const box = document.getElementById('gig-detail');
const me = session.user;
let gig = null;

async function loadGig() {
  try {
    const data = await api(`/gigs/${gigId}`);
    gig = data.gig;
    render();
  } catch (err) {
    box.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function render() {
  const isOwner = me && me.id === gig.giver.id;
  const hasContract = !!gig.contract;

  box.innerHTML = `
    <div class="card gig-head">
      <div class="top">
        <span class="chip">${escapeHtml(gig.discipline)}</span>
        <span class="badge ${gig.status}">${gig.status}</span>
        ${gig.status === 'OPEN' ? '' : gig._count.applications + ' applied'}
      </div>
      <h1>${escapeHtml(gig.title)}</h1>
      <div class="giver-row">
        ${avatarHtml(gig.giver.name, gig.giver.profile && gig.giver.profile.photoPath, 30)}
        <a href="/pages/profile.html?id=${gig.giver.id}">${escapeHtml(gig.giver.name)}</a>
        ${gig.giver.plan === 'PRO' ? '<span class="badge PRO">PRO</span>' : ''}
        ${stars(gig.giverRating)}
      </div>
      <div class="detail-meta">
        <div class="box"><div class="k">Budget</div><div class="v">${money(gig.budget)}</div></div>
        <div class="box"><div class="k">City</div><div class="v">${escapeHtml(gig.city)}</div></div>
        <div class="box"><div class="k">Shoot date</div><div class="v">${fmtDate(gig.shootDate)}</div></div>
        <div class="box"><div class="k">People needed</div><div class="v">${gig.peopleNeeded}</div></div>
      </div>
      <p>${escapeHtml(gig.description)}</p>
      ${hasContract ? `<a class="btn ghost" href="/pages/contract.html?id=${gig.contract.id}">Open the contract →</a>` : ''}
    </div>`;

  // --- Owner view: applicants + contract creation ---
  const ownerSection = document.getElementById('owner-section');
  if (isOwner && !hasContract) {
    ownerSection.hidden = false;
    loadApplicants();
  } else {
    ownerSection.hidden = true;
  }

  // --- Taker view: apply form ---
  const applySection = document.getElementById('apply-section');
  if (!me) {
    applySection.hidden = false;
    applySection.innerHTML = `<p class="muted"><a href="/pages/login.html">Log in</a> to apply for this gig.</p>`;
  } else if (!isOwner && gig.status === 'OPEN' && !hasContract) {
    applySection.hidden = false;
    bindApplyForm();
  } else {
    applySection.hidden = true;
  }
}

async function loadApplicants() {
  const list = document.getElementById('applicants');
  const formBox = document.getElementById('contract-form-box');
  try {
    const data = await api(`/gigs/${gigId}/applications`);
    if (data.applications.length === 0) {
      list.innerHTML = '<div class="empty-state">No applications yet.</div>';
    } else {
      list.innerHTML = data.applications.map((a) => `
        <div class="applicant-row">
          ${avatarHtml(a.applicant.name, a.applicant.profile && a.applicant.profile.photoPath, 38)}
          <div class="who">
            <a href="/pages/profile.html?id=${a.applicant.id}"><strong>${escapeHtml(a.applicant.name)}</strong></a>
            <span class="small">${escapeHtml(a.applicant.profile ? a.applicant.profile.discipline || '' : '')}
              ${stars(a.applicantRating)}</span>
          </div>
          <span class="badge ${a.status}">${a.status}</span>
          ${a.status === 'PENDING' && gig.status === 'OPEN' && !gig.contract
            ? `<button class="btn sm" data-accept="${a.id}" data-taker="${a.applicant.id}" data-name="${escapeHtml(a.applicant.name)}">Accept</button>`
            : ''}
          ${a.status === 'ACCEPTED' ? '<span class="small muted">✔ accepted</span>' : ''}
          <p class="applicant-msg">${escapeHtml(a.message)}</p>
        </div>`).join('');
    }

    // Accept → shows the contract form
    list.querySelectorAll('[data-accept]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/applications/${btn.dataset.accept}/accept`, { method: 'POST' });
          toast('Applicant accepted. Now create the contract.', 'success');
          await loadGig();
          document.getElementById('c-taker').value = btn.dataset.name;
          document.getElementById('c-taker').dataset.takerId = btn.dataset.taker;
          formBox.hidden = false;
          formBox.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function bindApplyForm() {
  document.getElementById('apply-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/gigs/${gigId}/apply`, {
        method: 'POST',
        body: { message: document.getElementById('message').value },
      });
      toast('Application sent!', 'success');
      document.getElementById('apply-section').hidden = true;
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

document.getElementById('contract-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const takerInput = document.getElementById('c-taker');
  const fd = new FormData();
  fd.append('gigId', String(gigId));
  fd.append('takerId', takerInput.dataset.takerId || '');
  fd.append('amount', document.getElementById('c-amount').value);
  const file = document.getElementById('c-file').files[0];
  if (file) fd.append('contract', file, file.name);

  try {
    const data = await api('/contracts', { method: 'POST', formData: fd });
    toast('Contract created — waiting for the taker to accept.', 'success');
    window.location.href = `/pages/contract.html?id=${data.contract.id}`;
  } catch (err) {
    toast(err.message, 'error');
  }
});

loadGig();
