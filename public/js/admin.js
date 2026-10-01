// Admin panel: disputes with decision buttons, flagged users with suspend
renderNavbar('admin');
initNavbarScroll();

const disputesBox = document.getElementById('disputes');
const flaggedBox = document.getElementById('flagged');

if (!session.user || session.user.role !== 'ADMIN') {
  document.querySelector('main').innerHTML =
    '<div class="empty-state">Admin access required. <a href="/pages/login.html">Log in</a> with an admin account.</div>';
  throw new Error('not admin');
}

function disputeCard(d) {
  const isOpen = d.status === 'OPEN';
  let context = '';
  if (d.gig) {
    const c = d.gig.contract;
    context = `
      <div class="meta-row">
        <span>GIG: <a href="/pages/gig-detail.html?id=${d.gig.id}">${escapeHtml(d.gig.title)}</a></span>
        <span class="badge ${d.gig.status}">${d.gig.status}</span>
        ${c ? `<span>giver <a href="/pages/profile.html?id=${c.giver.id}">${escapeHtml(c.giver.name)}</a> · taker <a href="/pages/profile.html?id=${c.taker.id}">${escapeHtml(c.taker.name)}</a></span>
               <span>amount ${money(c.amount)}</span>
               ${c.payment ? `<span>held ${money(c.payment.heldAmount - c.payment.releasedAmount)}</span>` : '<span class="muted">no escrow</span>'}` : ''}
      </div>`;
  } else if (d.rental) {
    context = `
      <div class="meta-row">
        <span>RENTAL: ${escapeHtml(d.rental.equipment.name)}</span>
        <span class="badge ${d.rental.status}">${d.rental.status}</span>
        <span>owner <a href="/pages/profile.html?id=${d.rental.equipment.owner.id}">${escapeHtml(d.rental.equipment.owner.name)}</a> · renter <a href="/pages/profile.html?id=${d.rental.renter.id}">${escapeHtml(d.renter.name)}</a></span>
        ${d.rental.payment ? `<span>held ${money(d.rental.payment.heldAmount - d.rental.payment.releasedAmount)}</span>` : '<span class="muted">no escrow</span>'}
      </div>`;
  }

  const buttons = isOpen
    ? (d.gig
      ? `<div class="decisions">
           <button class="btn sm" data-decide="${d.id}" data-choice="RELEASE_TO_TAKER">Release to taker</button>
           <button class="btn secondary sm" data-decide="${d.id}" data-choice="REFUND_TO_GIVER">Refund to giver</button>
           <button class="btn ghost sm" data-decide="${d.id}" data-choice="SPLIT">Split 50/50</button>
         </div>`
      : `<div class="decisions">
           <button class="btn sm" data-decide="${d.id}" data-choice="RELEASE_TO_OWNER">Release all to owner</button>
           <button class="btn secondary sm" data-decide="${d.id}" data-choice="REFUND_TO_RENTER">Refund all to renter</button>
           <button class="btn ghost sm" data-decide="${d.id}" data-choice="SPLIT">Rent to owner, split deposit</button>
         </div>`)
    : `<p class="small muted">Decision: <span class="badge RESOLVED">${d.decision}</span> by admin on ${fmtDate(d.decidedAt)}</p>`;

  return `
    <div class="card dispute-card ${isOpen ? '' : 'resolved'}">
      <div class="rental-head">
        <div><span class="badge ${d.status}">${d.status}</span> <strong>Dispute #${d.id}</strong>
          <span class="muted small">raised by <a href="/pages/profile.html?id=${d.raisedBy.id}">${escapeHtml(d.raisedBy.name)}</a> on ${fmtDate(d.createdAt)}</span></div>
      </div>
      ${context}
      <p class="small">“${escapeHtml(d.reason)}”</p>
      ${buttons}
    </div>`;
}

async function loadDisputes() {
  try {
    const data = await api('/admin/disputes');
    disputesBox.innerHTML = data.disputes.length
      ? data.disputes.map(disputeCard).join('')
      : '<div class="empty-state">No disputes. The marketplace is peaceful. 🎉</div>';

    disputesBox.querySelectorAll('[data-decide]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Decide: ${btn.dataset.choice}? This moves real (demo) money.`)) return;
        try {
          await api(`/admin/disputes/${btn.dataset.decide}/decide`, { method: 'POST', body: { decision: btn.dataset.choice } });
          toast('Dispute resolved.', 'success');
          loadDisputes();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  } catch (err) {
    disputesBox.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function loadFlagged() {
  try {
    const data = await api('/admin/flagged');
    const rows = [...data.flagged.map((u) => ({ ...u, flagged: true })), ...data.suspended.map((u) => ({ ...u, flagged: false, ratingsCount: null, averageRating: null }))];
    if (rows.length === 0) {
      flaggedBox.innerHTML = '<div class="empty-state">No flagged or suspended users.</div>';
      return;
    }
    flaggedBox.innerHTML = `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>User</th><th>Email</th><th>Avg rating</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map((u) => `
        <tr>
          <td><a href="/pages/profile.html?id=${u.id}">${escapeHtml(u.name)}</a></td>
          <td class="muted small">${escapeHtml(u.email)}</td>
          <td>${u.averageRating !== null ? stars(u.averageRating) + ` <span class="muted small">(${u.ratingsCount})</span>` : '<span class="muted small">—</span>'}</td>
          <td>${u.isSuspended ? '<span class="badge DISPUTED">suspended</span>' : '<span class="badge ACTIVE">active</span>'}</td>
          <td><button class="btn ${u.isSuspended ? 'secondary' : 'danger'} sm" data-suspend="${u.id}" data-to="${!u.isSuspended}">
            ${u.isSuspended ? 'Unsuspend' : 'Suspend'}</button></td>
        </tr>`).join('')}</tbody>
    </table></div></div>`;

    flaggedBox.querySelectorAll('[data-suspend]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const data = await api(`/admin/users/${btn.dataset.suspend}/suspend`, { method: 'POST', body: { suspend: btn.dataset.to === 'true' } });
          toast(data.message, 'success');
          loadFlagged();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  } catch (err) {
    flaggedBox.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

loadDisputes();
loadFlagged();
