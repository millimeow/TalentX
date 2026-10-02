// TalentX end-to-end API test — exercises every flow against a running server.
// Usage: node /tmp/studiox-e2e.mjs
const BASE = 'http://localhost:3100/api/v1';
let passed = 0, failed = 0;

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

async function api(path, { method = 'GET', token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !formData) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: formData ? formData : body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

function makePdf(lines) {
  const text = lines.map((l, i) => `BT /F1 11 Tf 50 ${760 - i * 18} Td (${l}) Tj ET`).join('\n');
  return `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n4 0 obj << /Length ${text.length} >> stream\n${text}\nendstream endobj\ntrailer << /Size 5 /Root 1 0 R >>\n%%EOF`;
}

async function register(name, email, password = 'password123') {
  const r = await api('/auth/register', { method: 'POST', body: { name, email, password } });
  if (r.status === 409) {
    const l = await api('/auth/login', { method: 'POST', body: { email, password } });
    return l.data;
  }
  return r.data;
}

const suffix = Date.now();
console.log('== Auth ==');
const giver = await register('Test Giver', `giver${suffix}@test.io`);
const taker = await register('Test Taker', `taker${suffix}@test.io`);
check('register giver + taker', !!giver.accessToken && !!taker.accessToken);
const g = giver.accessToken, t = taker.accessToken;

const badLogin = await api('/auth/login', { method: 'POST', body: { email: `giver${suffix}@test.io`, password: 'wrong' } });
check('wrong password -> 401', badLogin.status === 401);
const noAuth = await api('/gigs', { method: 'POST', body: {} });
check('protected route without token -> 401', noAuth.status === 401);
const refreshRes = await api('/auth/refresh', { method: 'POST', body: { refreshToken: giver.refreshToken } });
check('refresh token rotation works', refreshRes.status === 200 && !!refreshRes.data.accessToken);

console.log('== Wallet ==');
await api('/wallet/topup', { method: 'POST', token: g, body: { amount: 20000 } });
await api('/wallet/topup', { method: 'POST', token: t, body: { amount: 5000 } });
const walletG = await api('/wallet', { token: g });
check('giver balance 20000', walletG.data.balance === 20000, `got ${walletG.data.balance}`);
const badTopup = await api('/wallet/topup', { method: 'POST', token: g, body: { amount: -5 } });
check('negative topup -> 400', badTopup.status === 400);

console.log('== Gigs ==');
const gigRes = await api('/gigs', { method: 'POST', token: g, body: {
  title: 'E2E test gig', description: 'A gig created by the e2e test.', discipline: 'photographer',
  city: 'Mumbai', shootDate: '2026-11-20', budget: 12000,
} });
check('create gig -> 201', gigRes.status === 201, JSON.stringify(gigRes.data));
const gigId = gigRes.data.gig.id;
const gig2 = await api('/gigs', { method: 'POST', token: g, body: { title: 'x2', description: 'x', discipline: 'model', city: 'Pune', shootDate: '2026-11-21', budget: 100 } });
const gig3 = await api('/gigs', { method: 'POST', token: g, body: { title: 'x3', description: 'x', discipline: 'model', city: 'Pune', shootDate: '2026-11-22', budget: 100 } });
const gig4 = await api('/gigs', { method: 'POST', token: g, body: { title: 'x4', description: 'x', discipline: 'model', city: 'Pune', shootDate: '2026-11-23', budget: 100 } });
check('free plan 4th gig this month -> 403', gig4.status === 403, `got ${gig4.status}`);

const ownApply = await api(`/gigs/${gigId}/apply`, { method: 'POST', token: g, body: { message: 'me!' } });
check('cannot apply to own gig -> 403', ownApply.status === 403);
const applyRes = await api(`/gigs/${gigId}/apply`, { method: 'POST', token: t, body: { message: 'I am perfect for this.' } });
check('taker applies -> 201', applyRes.status === 201);
const dupApply = await api(`/gigs/${gigId}/apply`, { method: 'POST', token: t, body: { message: 'again' } });
check('duplicate application -> 409', dupApply.status === 409);

console.log('== Applications ==');
const apps = await api(`/gigs/${gigId}/applications`, { token: g });
check('giver sees 1 applicant', apps.data.applications.length === 1);
const appId = apps.data.applications[0].id;
const acceptByTaker = await api(`/applications/${appId}/accept`, { method: 'POST', token: t });
check('taker cannot accept -> 403', acceptByTaker.status === 403);
const acceptRes = await api(`/applications/${appId}/accept`, { method: 'POST', token: g });
check('giver accepts -> gig HIRED', acceptRes.status === 200);

console.log('== Contract + escrow ==');
const pdf = makePdf(['TALENTX CONTRACT', 'Parties: Test Giver / Test Taker', 'Amount: INR 12000', '50/50 payout rule applies.']);
const form = new FormData();
form.append('gigId', String(gigId));
form.append('takerId', String(taker.user.id));
form.append('amount', '12000');
form.append('contract', new Blob([pdf], { type: 'application/pdf' }), 'contract.pdf');
const contractRes = await api('/contracts', { method: 'POST', token: g, formData: form });
check('create contract with PDF -> 201', contractRes.status === 201, JSON.stringify(contractRes.data));
const contractId = contractRes.data.contract.id;

const pdfForeign = await api(`/contracts/${contractId}/pdf`, { token: (await register('X', `x${suffix}@test.io`)).accessToken });
check('stranger cannot open contract PDF -> 403', pdfForeign.status === 403);
const pdfRes = await api(`/contracts/${contractId}/pdf`, { token: t });
check('taker downloads PDF -> 200', pdfRes.status === 200);

const depositEarly = await api(`/contracts/${contractId}/deposit`, { method: 'POST', token: g });
check('deposit before taker accepts -> 400', depositEarly.status === 400);
const acceptRes2 = await api(`/contracts/${contractId}/accept`, { method: 'POST', token: t });
check('taker accepts contract', acceptRes2.status === 200);
const acceptByGiver = await api(`/contracts/${contractId}/accept`, { method: 'POST', token: g });
check('giver cannot accept own contract -> 403', acceptByGiver.status === 403);

const depositRes = await api(`/contracts/${contractId}/deposit`, { method: 'POST', token: g });
check('giver deposits 12000 into escrow', depositRes.status === 200 && depositRes.data.payment.status === 'HELD');
const walletG2 = await api('/wallet', { token: g });
check('giver balance now 8000', walletG2.data.balance === 8000, `got ${walletG2.data.balance}`);

const confirmByTaker = await api(`/contracts/${contractId}/confirm-shoot`, { method: 'POST', token: t });
check('taker cannot confirm shoot -> 403', confirmByTaker.status === 403);
const confirmRes = await api(`/contracts/${contractId}/confirm-shoot`, { method: 'POST', token: g });
check('confirm shoot releases first 50% (6000)', confirmRes.data.released === 6000);
const walletT = await api('/wallet', { token: t });
check('taker balance 5000+6000=11000', walletT.data.balance === 11000, `got ${walletT.data.balance}`);

const deliverByGiver = await api(`/contracts/${contractId}/deliver`, { method: 'POST', token: g, body: { url: 'https://example.com/x' } });
check('giver cannot deliver -> 403', deliverByGiver.status === 403);
const dForm = new FormData();
dForm.append('url', 'https://drive.google.com/file/d/demo');
dForm.append('file', new Blob(['final photos'], { type: 'image/jpeg' }), 'final.jpg');
const deliverRes = await api(`/contracts/${contractId}/deliver`, { method: 'POST', token: t, formData: dForm });
check('taker delivers (file + link)', deliverRes.status === 200);

const approveRes = await api(`/contracts/${contractId}/approve`, { method: 'POST', token: g });
check('giver approves -> remaining 50% released', approveRes.data.released === 6000);
const walletT2 = await api('/wallet', { token: t });
check('taker balance now 17000', walletT2.data.balance === 17000, `got ${walletT2.data.balance}`);
const gigAfter = await api(`/gigs/${gigId}`);
check('gig status COMPLETED', gigAfter.data.gig.status === 'COMPLETED');

console.log('== Ratings ==');
const rateRes = await api('/ratings', { method: 'POST', token: g, body: {
  gigId, toUserId: taker.user.id, professionalism: 5, punctuality: 4, quality: 5, communication: 5, comment: 'Great.' } });
check('giver rates taker -> 201', rateRes.status === 201);
const rateDup = await api('/ratings', { method: 'POST', token: g, body: {
  gigId, toUserId: taker.user.id, professionalism: 5, punctuality: 4, quality: 5, communication: 5 } });
check('second rating same gig -> 409', rateDup.status === 409);
await api('/ratings', { method: 'POST', token: t, body: {
  gigId, toUserId: giver.user.id, professionalism: 5, punctuality: 5, quality: 5, communication: 5 } });
const pub = await api(`/users/${taker.user.id}/ratings`);
check('taker has a rating average', typeof pub.data.average === 'number' && pub.data.average >= 1 && pub.data.average <= 5, `got ${pub.data.average}`);

console.log('== Dispute flow (second gig, split decision) ==');
await api('/wallet/topup', { method: 'POST', token: g, body: { amount: 40000 } });
// giver already hit free gig limit this month -> upgrade to PRO first
await api('/plans/upgrade', { method: 'POST', token: g });
const gigD = await api('/gigs', { method: 'POST', token: g, body: { title: 'Dispute gig', description: 'x', discipline: 'model', city: 'Mumbai', shootDate: '2026-12-01', budget: 8000 } });
check('PRO plan bypasses limit', gigD.status === 201);
await api(`/gigs/${gigD.data.gig.id}/apply`, { method: 'POST', token: t, body: { message: 'hi' } });
const appsD = await api(`/gigs/${gigD.data.gig.id}/applications`, { token: g });
await api(`/applications/${appsD.data.applications[0].id}/accept`, { method: 'POST', token: g });
const formD = new FormData();
formD.append('gigId', String(gigD.data.gig.id));
formD.append('takerId', String(taker.user.id));
formD.append('amount', '8000');
formD.append('contract', new Blob([makePdf(['Dispute demo contract'])], { type: 'application/pdf' }), 'd.pdf');
const contractD = await api('/contracts', { method: 'POST', token: g, formData: formD });
await api(`/contracts/${contractD.data.contract.id}/accept`, { method: 'POST', token: t });
await api(`/contracts/${contractD.data.contract.id}/deposit`, { method: 'POST', token: g });
await api(`/contracts/${contractD.data.contract.id}/confirm-shoot`, { method: 'POST', token: g });
const dForm2 = new FormData();
dForm2.append('file', new Blob(['work'], { type: 'image/jpeg' }), 'work.jpg');
await api(`/contracts/${contractD.data.contract.id}/deliver`, { method: 'POST', token: t, formData: dForm2 });
const disputeRes = await api(`/contracts/${contractD.data.contract.id}/dispute`, { method: 'POST', token: g, body: { reason: 'Wrong crop on everything.' } });
check('giver raises dispute -> 201', disputeRes.status === 201);
const approveBlocked = await api(`/contracts/${contractD.data.contract.id}/approve`, { method: 'POST', token: g });
check('approve blocked while dispute open -> 409', approveBlocked.status === 409);

const admin = await register('Admin E2E', `admin${suffix}@test.io`, 'admin123');
await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@studiox.test', password: 'admin123' }) });
const adminLogin = await api('/auth/login', { method: 'POST', body: { email: 'admin@studiox.test', password: 'admin123' } });
const a = adminLogin.data.accessToken;
const adminForbidden = await api('/admin/disputes', { token: g });
check('non-admin blocked from admin panel -> 403', adminForbidden.status === 403);
const disputes = await api('/admin/disputes', { token: a });
const myDispute = disputes.data.disputes.find((d) => d.gigId === gigD.data.gig.id);
check('admin sees the dispute', !!myDispute);
const decideRes = await api(`/admin/disputes/${myDispute.id}/decide`, { method: 'POST', token: a, body: { decision: 'SPLIT' } });
check('admin decides SPLIT', decideRes.status === 200);
const walletT3 = await api('/wallet', { token: t });
check('taker got +2000 (half of remaining 4000)', walletT3.data.balance === 23000, `got ${walletT3.data.balance}`);

console.log('== Rental flow ==');
const equipList = await api('/equipment?category=CAMERA');
const equip = equipList.data.equipment.find((e) => e.name.includes("Sony")) || equipList.data.equipment[0];
check('equipment list works', !!equip);
const ownerLogin = await api('/auth/login', { method: 'POST', body: { email: 'kabir@studiox.test', password: 'password123' } });
const o = ownerLogin.data.accessToken;
await api('/wallet/topup', { method: 'POST', token: t, body: { amount: 30000 } });
const rentalRes = await api('/rentals', { method: 'POST', token: t, body: { equipmentId: equip.id, startDate: '2026-11-01', endDate: '2026-11-04' } });
check('renter requests dates -> 201', rentalRes.status === 201, JSON.stringify(rentalRes.data));
const rentalId = rentalRes.data.rental.id;
const overlap = await api('/rentals', { method: 'POST', token: (await register('R2', `r2${suffix}@test.io`)).accessToken, body: { equipmentId: equip.id, startDate: '2026-11-02', endDate: '2026-11-05' } });
check('pending request does not block (only approved do)', overlap.status === 201, `got ${overlap.status}`);
const renterApprove = await api(`/rentals/${rentalId}/approve`, { method: 'POST', token: t });
check('renter cannot self-approve -> 403', renterApprove.status === 403);
const formR = new FormData();
formR.append('agreement', new Blob([makePdf(['RENTAL AGREEMENT', 'Sony A7IV, 3 days'])], { type: 'application/pdf' }), 'agreement.pdf');
const approveRes2 = await api(`/rentals/${rentalId}/approve`, { method: 'POST', token: o, formData: formR });
check('owner approves + uploads agreement (rent 7500, deposit 10000)', approveRes2.data.rental.rentAmount === 7500, JSON.stringify(approveRes2.data));
const payRes = await api(`/rentals/${rentalId}/sign-and-pay`, { method: 'POST', token: t });
check('renter pays rent+deposit (17500) into escrow', payRes.status === 200);
const insForm = new FormData();
insForm.append('type', 'PRE');
insForm.append('conditionScore', '5');
insForm.append('note', 'Shutter count low, no scratches.');
insForm.append('photo', new Blob(['img'], { type: 'image/jpeg' }), 'pre.jpg');
const preRes = await api(`/rentals/${rentalId}/inspection`, { method: 'POST', token: t, formData: insForm });
check('PRE inspection by renter -> 201', preRes.status === 201, JSON.stringify(preRes.data));
const returnRes = await api(`/rentals/${rentalId}/return`, { method: 'POST', token: o });
check('owner confirms return: rent released, deposit refunded', returnRes.status === 200);
const walletRenter = await api('/wallet', { token: t });
check('renter refunded deposit (17500-7500 flow)', walletRenter.data.balance === 45500, `got ${walletRenter.data.balance}`);
const rateRental = await api('/ratings', { method: 'POST', token: o, body: {
  rentalId, toUserId: taker.user.id, professionalism: 5, punctuality: 5, quality: 5, communication: 5, equipmentCare: 5 } });
check('owner rates renter on rental', rateRental.status === 201);

console.log('== Admin flagged/suspend ==');
const flagged = await api('/admin/flagged', { token: a });
check('flagged list contains kabir', flagged.data.flagged.some((u) => u.email === 'kabir@studiox.test'));
const suspRes = await api(`/admin/users/${taker.user.id}/suspend`, { method: 'POST', token: a, body: { suspend: true } });
check('admin suspends taker', suspRes.status === 200);
const suspendedCall = await api('/wallet', { token: t });
check('suspended user blocked -> 403', suspendedCall.status === 403);
await api(`/admin/users/${taker.user.id}/suspend`, { method: 'POST', token: a, body: { suspend: false } });

console.log('== Google OAuth endpoints ==');
const gcid = await api('/auth/google-client-id');
check('google client id endpoint responds', gcid.status === 200 && 'clientId' in gcid.data);
const gbad = await api('/auth/google', { method: 'POST', body: { credential: 'not-a-real-token' } });
check('invalid google credential rejected', [400, 401, 501].includes(gbad.status), `got ${gbad.status}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
