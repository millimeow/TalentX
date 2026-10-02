// Contract page: escrow timeline, PDF access and every action in the 50/50 flow.
renderNavbar('dashboard');
initNavbarScroll();

const contractId = Number(getParam('id'));
const box = document.getElementById('contract-detail');
const me = session.user;
let contract = null;
let rated = false;

async function loadContract() {
  try {
    const data = await api(`/contracts/${contractId}`);
    contract = data.contract;
    render();
  } catch (err) {
    box.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function timelineSteps() {
  return [
    { label: 'Contract created', done: true },
    { label: `Taker accepted (${escapeHtml(contract.taker.name)})`, done: contract.takerAccepted, current: !contract.takerAccepted },
    { label: 'Deposit held in escrow', done: contract.depositPaid, current: contract.takerAccepted && !contract.depositPaid },
    { label: 'Shoot confirmed — 50% released', done: contract.shootConfirmed, current: contract.depositPaid && !contract.shootConfirmed },
    { label: 'Deliverable submitted', done: !!contract.deliveredAt, current: contract.shootConfirmed && !contract.deliveredAt },
    { label: 'Approved — remaining 50% released', done: !!contract.completedAt, current: !!contract.deliveredAt && !contract.completedAt },
  ];
}

function render() {
  const isGiver = me.id === contract.giverId;
  const isTaker = me.id === contract.takerId;
  const payment = contract.payment;
  const held = payment ? payment.heldAmount : 0;
  const released = payment ? payment.releasedAmount : 0;
  const pct = held > 0 ? Math.round((released / held) * 100) : 0;

  const openDispute = contract.gig.status === 'DISPUTED';

  box.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Contract #${contract.id}</h1>
        <p class="muted">for <a href="/pages/gig-detail.html?id=${contract.gig.id}">${escapeHtml(contract.gig.title)}</a> · <span class="badge ${contract.gig.status}">${contract.gig.status}</span></p>
      </div>
      <span class="badge ${payment ? payment.status : 'PENDING'}">${payment ? 'Escrow: ' + payment.status : 'Escrow: not funded'}</span>
    </div>

    <div class="contract-grid">
      <div style="display:grid; gap:18px;">
        <div class="card">
          <h3>Parties</h3>
          <div class="parties">
            <div><span class="k muted small">Giver</span><a href="/pages/profile.html?id=${contract.giver.id}">${escapeHtml(contract.giver.name)}</a></div>
            <div><span class="k muted small">Taker</span><a href="/pages/profile.html?id=${contract.taker.id}">${escapeHtml(contract.taker.name)}</a></div>
            <div><span class="k muted small">Amount</span><strong>${money(contract.amount)}</strong></div>
            <div><span class="k muted small">Created</span>${fmtDate(contract.createdAt)}</div>
          </div>
          <hr class="divider">
          <h3>Contract PDF</h3>
          <p class="muted small">Only the giver, the taker and admins can open this file.</p>
          <div class="pdf-actions">
            <button class="btn secondary sm" id="view-pdf">View PDF</button>
            <a class="btn ghost sm" href="/api/v1/contracts/${contract.id}/pdf" download onclick="return downloadPdf(event)">Download PDF</a>
          </div>
        </div>

        ${openDispute ? `<div class="action-box" style="border-color: rgba(248,113,113,0.4);">
          <h3>⚖️ Dispute open</h3>
          <p class="muted small">The remaining escrow is frozen. An admin reads the contract and decides: release to the taker, refund to the giver, or split.</p>
        </div>` : ''}

        ${buildActions(isGiver, isTaker, openDispute)}
      </div>

      <div style="display:grid; gap:18px;">
        <div class="card payment-box">
          <h3>Escrow</h3>
          <div class="big">${money(released)} <span class="muted" style="font-size:0.9rem">/ ${money(held)} released</span></div>
          <div class="progress"><div class="fill" style="width:${pct}%"></div></div>
          <p class="muted small">${pct === 100 ? 'Fully released.' : `${100 - pct}% still held (${money(held - released)})`}</p>
          <hr class="divider">
          <h3>Progress</h3>
          <ul class="timeline">
            ${timelineSteps().map((s) => `
              <li class="${s.done ? 'done' : s.current ? 'current' : ''}">
                <span class="tick">${s.done ? '✓' : '·'}</span><span class="small">${s.label}</span>
              </li>`).join('')}
          </ul>
          ${contract.deliveredAt ? `<hr class="divider"><p class="small muted">Deliverable: ${contract.deliverablePath ? `<a href="${escapeHtml(fileUrl(contract.deliverablePath))}" target="_blank">uploaded file</a>` : ''} ${contract.deliverableUrl ? `<a href="${escapeHtml(contract.deliverableUrl)}" target="_blank">link</a>` : ''} (${fmtDate(contract.deliveredAt)})</p>` : ''}
        </div>
      </div>
    </div>`;

  bindActions(isGiver, isTaker);
}

function buildActions(isGiver, isTaker, openDispute) {
  const done = !!contract.completedAt;
  if (done && rated) return '';
  if (done) {
    return `<div class="action-box" id="rate-box">
      <h3>⭐ Rate the other side</h3>
      <p class="muted small">${isGiver ? 'How was ' + escapeHtml(contract.taker.name) + '?' : 'How was ' + escapeHtml(contract.giver.name) + ' to work with?'}</p>
      <form id="rate-form" class="form-grid">
        <div class="rate-grid"><label>Professionalism</label><select class="score" name="professionalism">${scoreOptions()}</select></div>
        <div class="rate-grid"><label>Punctuality</label><select class="score" name="punctuality">${scoreOptions()}</select></div>
        <div class="rate-grid"><label>${isGiver ? 'Delivery quality' : 'Payment promptness'}</label><select class="score" name="quality">${scoreOptions()}</select></div>
        <div class="rate-grid"><label>Communication</label><select class="score" name="communication">${scoreOptions()}</select></div>
        <div><label>Comment (optional)</label><input name="comment" placeholder="Anything worth mentioning"></div>
        <button class="btn" type="submit">Submit rating</button>
      </form>
    </div>`;
  }

  let html = '<div class="actions">';
  if (isTaker && !contract.takerAccepted) {
    html += `<div class="action-box"><h3>Step 1 — Accept the contract</h3>
      <p class="muted small">Read the PDF, then accept. This is your digital signature for the MVP.</p>
      <button class="btn" id="act-accept">I accept this contract</button></div>`;
  }
  if (isGiver && contract.takerAccepted && !contract.depositPaid) {
    html += `<div class="action-box"><h3>Step 2 — Deposit ${money(contract.amount)} into escrow</h3>
      <p class="muted small">Your wallet balance: ${money(me.walletBalance)}. The money sits in escrow until the work is done.</p>
      <button class="btn" id="act-deposit">Deposit full amount</button></div>`;
  }
  if (isGiver && contract.depositPaid && !contract.shootConfirmed) {
    html += `<div class="action-box"><h3>Step 3 — Confirm the shoot finished</h3>
      <p class="muted small">This releases the first 50% (${money(Math.floor(contract.amount / 2))}) to ${escapeHtml(contract.taker.name)}.</p>
      <button class="btn" id="act-confirm">Confirm shoot finished</button></div>`;
  }
  if (isTaker && contract.shootConfirmed && !contract.deliveredAt) {
    html += `<div class="action-box"><h3>Step 4 — Deliver your work</h3>
      <p class="muted small">Upload the final file (image, up to 5 MB) or paste a link for large videos.</p>
      <form id="deliver-form" class="form-grid">
        <div><label for="d-file">File (optional)</label><input id="d-file" type="file" accept="image/*"></div>
        <div><label for="d-url">Link for large videos (optional)</label><input id="d-url" type="url" placeholder="https://drive.google.com/…"></div>
        <button class="btn" type="submit">Submit deliverable</button>
      </form></div>`;
  }
  if (isGiver && contract.deliveredAt && !openDispute) {
    html += `<div class="action-box"><h3>Step 5 — Approve the delivery</h3>
      <p class="muted small">Releases the remaining ${money(contract.payment.heldAmount - contract.payment.releasedAmount)}. If you are not happy, raise a dispute instead and an admin decides.</p>
      <div class="two-col">
        <button class="btn" id="act-approve">Approve &amp; release</button>
        <button class="btn danger" id="act-dispute-toggle">Raise dispute</button>
      </div>
      <form id="dispute-form" class="form-grid" hidden>
        <div><label for="dis-reason">What went wrong?</label><textarea id="dis-reason" required placeholder="Describe the problem — the admin will read the contract."></textarea></div>
        <button class="btn danger" type="submit">Freeze the money &amp; open dispute</button>
      </form></div>`;
  } else if (!openDispute && (isGiver || isTaker) && contract.depositPaid && !done) {
    html += `<div class="action-box"><h3>Something wrong?</h3>
      <button class="btn danger sm" id="act-dispute-toggle">Raise a dispute</button>
      <form id="dispute-form" class="form-grid" hidden>
        <div><label for="dis-reason">What went wrong?</label><textarea id="dis-reason" required></textarea></div>
        <button class="btn danger" type="submit">Freeze the money &amp; open dispute</button>
      </form></div>`;
  }
  html += '</div>';
  return html;
}

function scoreOptions() {
  return [5, 4, 3, 2, 1].map((n) => `<option value="${n}">${n} — ${['', 'poor', 'weak', 'okay', 'good', 'excellent'][n]}</option>`).join('');
}

function bindActions(isGiver, isTaker) {
  // PDF: fetch with auth header, open as blob (the endpoint checks ownership)
  const viewBtn = document.getElementById('view-pdf');
  if (viewBtn) viewBtn.addEventListener('click', () => openPdf('view'));

  const accept = document.getElementById('act-accept');
  if (accept) accept.addEventListener('click', () => act('/contracts/' + contractId + '/accept', 'Contract accepted — the giver can now deposit.'));

  const deposit = document.getElementById('act-deposit');
  if (deposit) deposit.addEventListener('click', () => act('/contracts/' + contractId + '/deposit', 'Full amount is now held in escrow.'));

  const confirm = document.getElementById('act-confirm');
  if (confirm) confirm.addEventListener('click', () => act('/contracts/' + contractId + '/confirm-shoot', 'First 50% released to the taker.'));

  const approve = document.getElementById('act-approve');
  if (approve) approve.addEventListener('click', () => act('/contracts/' + contractId + '/approve', 'Remaining 50% released. Gig completed!'));

  const deliverForm = document.getElementById('deliver-form');
  if (deliverForm) deliverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    const url = document.getElementById('d-url').value.trim();
    if (url) fd.append('url', url);
    const file = document.getElementById('d-file').files[0];
    if (file) fd.append('file', file, file.name);
    try {
      await api('/contracts/' + contractId + '/deliver', { method: 'POST', formData: fd });
      toast('Deliverable submitted — waiting for approval (auto-releases after 5 days).', 'success');
      loadContract();
    } catch (err) { toast(err.message, 'error'); }
  });

  const disputeToggle = document.getElementById('act-dispute-toggle');
  const disputeForm = document.getElementById('dispute-form');
  if (disputeToggle && disputeForm) {
    disputeToggle.addEventListener('click', () => { disputeForm.hidden = !disputeForm.hidden; });
    disputeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/contracts/' + contractId + '/dispute', { method: 'POST', body: { reason: document.getElementById('dis-reason').value } });
        toast('Dispute opened — escrow frozen until an admin decides.', 'success');
        loadContract();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  const rateForm = document.getElementById('rate-form');
  if (rateForm) rateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(rateForm);
    try {
      await api('/ratings', {
        method: 'POST',
        body: {
          gigId: contract.gigId,
          toUserId: isGiver ? contract.takerId : contract.giverId,
          professionalism: Number(fd.get('professionalism')),
          punctuality: Number(fd.get('punctuality')),
          quality: Number(fd.get('quality')),
          communication: Number(fd.get('communication')),
          comment: fd.get('comment') || undefined,
        },
      });
      rated = true;
      toast('Thanks for rating!', 'success');
      loadContract();
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function act(path, successMessage) {
  try {
    await api(path, { method: 'POST' });
    toast(successMessage, 'success');
    await refreshStoredUser();
    loadContract();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Opens/downloads the PDF via an authed fetch (a plain link cannot send the JWT)
async function openPdf(mode) {
  try {
    const res = await fetch(`/api/v1/contracts/${contractId}/pdf`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Could not open PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (mode === 'view') window.open(url, '_blank');
    else {
      const a = document.createElement('a');
      a.href = url; a.download = `studiox-contract-${contractId}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } catch (err) { toast(err.message, 'error'); }
}

function downloadPdf(e) {
  e.preventDefault();
  openPdf('download');
  return false;
}

requireAuth();
loadContract();
