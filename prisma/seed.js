// TalentX seed data — run with: node prisma/seed.js
// Demo accounts (password for all users: password123, admin: admin123)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Builds a small, valid single-page PDF with the given text lines.
function makePdf(lines) {
  const text = lines
    .map((line, i) => `BT /F1 11 Tf 50 ${760 - i * 18} Td (${line.replace(/[\\()]/g, '')}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

// Demo files land on disk locally, or in Vercel Blob when BLOB_READ_WRITE_TOKEN
// is provided — so contract PDFs work on hosted deployments too:
//   BLOB_READ_WRITE_TOKEN="..." DATABASE_URL="..." node prisma/seed.js
async function writeUploadFile(folder, filename, content) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = require('@vercel/blob');
    const blob = await put(`${folder}/${filename}`, content, { access: 'public', addRandomSuffix: true });
    return blob.url;
  }
  const dir = path.join(__dirname, '..', 'uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content);
  return `${folder}/${filename}`;
}

async function main() {
  console.log('Seeding TalentX...');

  // Wipe in an order that respects foreign keys
  await prisma.dispute.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.application.deleteMany();
  await prisma.rental.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.portfolioItem.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.gig.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('password123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.create({ data: {
    name: 'TalentX Admin', email: 'admin@talentx.test', passwordHash: adminPassword,
    role: 'ADMIN', walletBalance: 50000,
    profile: { create: { discipline: 'other', city: 'Mumbai', bio: 'Platform team.' } },
  } });

  const meera = await prisma.user.create({ data: {
    name: 'Meera Kapoor', email: 'meera@talentx.test', passwordHash: password,
    walletBalance: 20000,
    profile: { create: { discipline: 'photographer', city: 'Mumbai', bio: 'Fashion and portrait photographer, 6 years experience.', dayRate: 8000, credits: 'Vogue India (2024), Lakme Fashion Week backstage, Nykaa campaigns.', gearList: 'Sony A7IV, 85mm f/1.4, 2x Godox AD200' } },
  } });

  const arjun = await prisma.user.create({ data: {
    name: 'Arjun Mehta', email: 'arjun@talentx.test', passwordHash: password,
    walletBalance: 20000,
    profile: { create: { discipline: 'model', city: 'Mumbai', bio: 'Commercial and runway model.', dayRate: 6000, credits: 'Myntra runway, Spotify India social campaigns.' } },
  } });

  const zoya = await prisma.user.create({ data: {
    name: 'Zoya Rahman', email: 'zoya@talentx.test', passwordHash: password,
    plan: 'PRO', walletBalance: 12000,
    profile: { create: { discipline: 'cinematographer', city: 'Pune', bio: 'Music videos and brand films.', dayRate: 12000, credits: 'Music videos for indie labels, two web-series pilots.' } },
  } });

  const kabir = await prisma.user.create({ data: {
    name: 'Kabir Shah', email: 'kabir@talentx.test', passwordHash: password,
    walletBalance: 4000,
    profile: { create: { discipline: 'lighting', city: 'Delhi', bio: 'Gaffer and gear rental.', dayRate: 5000 } },
  } });

  // ---- Open gigs on the board ----
  await prisma.gig.create({ data: {
    giverId: meera.id, title: 'Fashion lookbook shoot', description: 'Two-day lookbook for a sustainable fashion label. Studio in Bandra, styling team already booked. Need a model for 24 outfits.',
    discipline: 'model', city: 'Mumbai', shootDate: new Date('2026-10-20'), budget: 15000, peopleNeeded: 1,
  } });
  await prisma.gig.create({ data: {
    giverId: meera.id, title: 'Second shooter — wedding', description: 'Need a second shooter for a South Indian wedding, candid coverage. Raw files handed over same night.',
    discipline: 'photographer', city: 'Mumbai', shootDate: new Date('2026-11-08'), budget: 9000, peopleNeeded: 1,
  } });
  await prisma.gig.create({ data: {
    giverId: zoya.id, title: 'Music video — performance scene', description: 'One performance scene for an indie track. We handle direction and lights; need a camera operator with own body.',
    discipline: 'photographer', city: 'Pune', shootDate: new Date('2026-10-28'), budget: 20000, peopleNeeded: 1,
  } });
  await prisma.gig.create({ data: {
    giverId: kabir.id, title: 'Product shoot lighting assistant', description: 'E-commerce product shoot, 3 days. Setting up and managing the lighting rig.',
    discipline: 'lighting', city: 'Delhi', shootDate: new Date('2026-11-15'), budget: 12000, peopleNeeded: 1,
  } });

  // ---- Completed gig (shows ratings on profiles) ----
  const doneGig = await prisma.gig.create({ data: {
    giverId: meera.id, title: 'Portfolio portraits', description: 'Portraits for an actor portfolio, 4 looks, one day.',
    discipline: 'model', city: 'Mumbai', shootDate: new Date('2026-09-10'), budget: 10000,
    status: 'COMPLETED',
  } });
  await prisma.application.create({ data: { gigId: doneGig.id, applicantId: arjun.id, message: 'Available that whole week, happy to share my book.', status: 'ACCEPTED' } });
  const doneContractPdf = await writeUploadFile('contracts', 'seed-contract-1.pdf', makePdf([
    'TALENTX CONTRACT', '', 'Parties: Meera Kapoor (Giver) and Arjun Mehta (Taker)',
    'Scope: Actor portfolio portraits, 4 looks, one day.', 'Date of shoot: 10 September 2026',
    'Amount: INR 10000', 'Payout rule: 50% after the shoot, 50% after delivery is approved.',
    'Escrow: full amount held by TalentX until both parts are released.',
  ]));
  const deliverableFile = await writeUploadFile('deliverables', 'seed-deliverable-1.txt', 'Final retouched portraits (demo deliverable).');
  const doneContract = await prisma.contract.create({ data: {
    gigId: doneGig.id, giverId: meera.id, takerId: arjun.id, pdfPath: doneContractPdf,
    amount: 10000, takerAccepted: true, depositPaid: true, shootConfirmed: true,
    deliverablePath: deliverableFile, deliveredAt: new Date(Date.now() - 3 * 86400000),
    completedAt: new Date(Date.now() - 2 * 86400000), createdAt: new Date(Date.now() - 5 * 86400000),
  } });
  await prisma.payment.create({ data: { contractId: doneContract.id, amount: 10000, heldAmount: 10000, releasedAmount: 10000, status: 'RELEASED', createdAt: new Date(Date.now() - 4 * 86400000) } });
  await prisma.walletTransaction.createMany({ data: [
    { userId: meera.id, amount: -10000, type: 'ESCROW_IN', referenceId: `contract:${doneGig.id}`, description: 'Escrow deposit', createdAt: new Date(Date.now() - 4 * 86400000) },
    { userId: arjun.id, amount: 5000, type: 'RELEASE', referenceId: `contract:${doneGig.id}`, description: '50% released after shoot confirmation', createdAt: new Date(Date.now() - 3 * 86400000) },
    { userId: arjun.id, amount: 5000, type: 'RELEASE', referenceId: `contract:${doneGig.id}`, description: 'Remaining 50% released on approval', createdAt: new Date(Date.now() - 2 * 86400000) },
  ] });
  await prisma.rating.createMany({ data: [
    { fromUserId: meera.id, toUserId: arjun.id, gigId: doneGig.id, professionalism: 5, punctuality: 5, quality: 5, communication: 5, comment: 'Punctual, great on set, took direction well.' },
    { fromUserId: arjun.id, toUserId: meera.id, gigId: doneGig.id, professionalism: 5, punctuality: 4, quality: 5, communication: 5, comment: 'Clear brief, paid on time through escrow.' },
  ] });

  // ---- Delivered 6 days ago: the auto-release job completes this on server start ----
  const staleGig = await prisma.gig.create({ data: {
    giverId: meera.id, title: 'Bakery social media reel stills', description: 'Stills for a bakery launch reel.',
    discipline: 'model', city: 'Mumbai', shootDate: new Date('2026-09-20'), budget: 6000,
    status: 'DELIVERED',
  } });
  await prisma.application.create({ data: { gigId: staleGig.id, applicantId: arjun.id, message: 'Love bakery shoots, count me in.', status: 'ACCEPTED' } });
  const stalePdf = await writeUploadFile('contracts', 'seed-contract-2.pdf', makePdf([
    'TALENTX CONTRACT', '', 'Parties: Meera Kapoor (Giver) and Arjun Mehta (Taker)',
    'Scope: Bakery launch reel stills.', 'Amount: INR 6000',
    'Payout rule: 50% after the shoot, 50% after delivery is approved.',
  ]));
  const staleContract = await prisma.contract.create({ data: {
    gigId: staleGig.id, giverId: meera.id, takerId: arjun.id, pdfPath: stalePdf,
    amount: 6000, takerAccepted: true, depositPaid: true, shootConfirmed: true,
    deliverablePath: deliverableFile, deliveredAt: new Date(Date.now() - 6 * 86400000),
    createdAt: new Date(Date.now() - 9 * 86400000),
  } });
  await prisma.payment.create({ data: { contractId: staleContract.id, amount: 6000, heldAmount: 6000, releasedAmount: 3000, status: 'HELD', createdAt: new Date(Date.now() - 8 * 86400000) } });
  await prisma.walletTransaction.createMany({ data: [
    { userId: meera.id, amount: -6000, type: 'ESCROW_IN', referenceId: `contract:${staleGig.id}`, description: 'Escrow deposit', createdAt: new Date(Date.now() - 8 * 86400000) },
    { userId: arjun.id, amount: 3000, type: 'RELEASE', referenceId: `contract:${staleGig.id}`, description: '50% released after shoot confirmation', createdAt: new Date(Date.now() - 7 * 86400000) },
  ] });

  // ---- Disputed gig (admin panel demo) ----
  const disputedGig = await prisma.gig.create({ data: {
    giverId: zoya.id, title: 'Wedding highlights edit', description: 'Edit a 3-minute highlights film from provided footage.',
    discipline: 'editor', city: 'Pune', shootDate: new Date('2026-09-15'), budget: 8000,
    status: 'DISPUTED',
  } });
  await prisma.application.create({ data: { gigId: disputedGig.id, applicantId: arjun.id, message: 'I edit weddings regularly, sample on my profile.', status: 'ACCEPTED' } });
  const disputedPdf = await writeUploadFile('contracts', 'seed-contract-3.pdf', makePdf([
    'TALENTX CONTRACT', '', 'Parties: Zoya Rahman (Giver) and Arjun Mehta (Taker)',
    'Scope: 3-minute wedding highlights edit.', 'Amount: INR 8000',
    'Payout rule: 50% after the shoot, 50% after delivery is approved.',
  ]));
  const disputedContract = await prisma.contract.create({ data: {
    gigId: disputedGig.id, giverId: zoya.id, takerId: arjun.id, pdfPath: disputedPdf,
    amount: 8000, takerAccepted: true, depositPaid: true, shootConfirmed: true,
    deliverablePath: deliverableFile, deliveredAt: new Date(Date.now() - 1 * 86400000),
    createdAt: new Date(Date.now() - 6 * 86400000),
  } });
  await prisma.payment.create({ data: { contractId: disputedContract.id, amount: 8000, heldAmount: 8000, releasedAmount: 4000, status: 'HELD', createdAt: new Date(Date.now() - 5 * 86400000) } });
  await prisma.dispute.create({ data: {
    gigId: disputedGig.id, raisedById: zoya.id,
    reason: 'Delivered cut uses the wrong music and misses two promised scenes.',
    createdAt: new Date(Date.now() - 86400000 / 2),
  } });
  await prisma.walletTransaction.createMany({ data: [
    { userId: zoya.id, amount: -8000, type: 'ESCROW_IN', referenceId: `contract:${disputedContract.id}`, description: 'Escrow deposit', createdAt: new Date(Date.now() - 5 * 86400000) },
    { userId: arjun.id, amount: 4000, type: 'RELEASE', referenceId: `contract:${disputedContract.id}`, description: '50% released after shoot confirmation', createdAt: new Date(Date.now() - 2 * 86400000) },
  ] });

  // ---- Portfolio ----
  await prisma.portfolioItem.createMany({ data: [
    { userId: zoya.id, title: 'Showreel 2026', type: 'VIDEO', url: 'https://www.youtube.com/watch?v=demo-showreel' },
    { userId: zoya.id, title: 'Night music video', type: 'VIDEO', url: 'https://www.youtube.com/watch?v=demo-night' },
    { userId: arjun.id, title: 'Runway walk — Myntra', type: 'VIDEO', url: 'https://www.youtube.com/watch?v=demo-runway' },
  ] });

  // ---- Equipment ----
  await prisma.equipment.createMany({ data: [
    { ownerId: kabir.id, name: 'Sony A7IV body + 24-70 f/2.8', category: 'CAMERA', pricePerDay: 2500, deposit: 10000, city: 'Delhi', description: 'Well kept, two batteries and 128GB card included.' },
    { ownerId: kabir.id, name: 'Godox SL-60W light kit (x2)', category: 'LIGHT', pricePerDay: 800, deposit: 3000, city: 'Delhi', description: 'Two lights with stands and softboxes.' },
    { ownerId: meera.id, name: 'Home studio space, Bandra', category: 'STUDIO', pricePerDay: 5000, deposit: 15000, city: 'Mumbai', description: 'Cyc wall, changing area, make-up corner. 10am-8pm.' },
  ] });

  // ---- Ratings that flag Kabir for admin review (avg < 2.0 after 5 ratings) ----
  // Ratings must reference a gig or rental, so we attach them to two archived demo gigs.
  const cleanupGig1 = await prisma.gig.create({ data: {
    giverId: admin.id, title: 'Studio cleanup day (archived)', description: 'Internal demo data.',
    discipline: 'other', city: 'Delhi', shootDate: new Date('2026-08-30'), budget: 1000,
    status: 'COMPLETED',
  } });
  const cleanupGig2 = await prisma.gig.create({ data: {
    giverId: admin.id, title: 'Gear inventory day (archived)', description: 'Internal demo data.',
    discipline: 'other', city: 'Delhi', shootDate: new Date('2026-08-31'), budget: 1000,
    status: 'COMPLETED',
  } });
  await prisma.rating.createMany({ data: [
    { fromUserId: meera.id, toUserId: kabir.id, gigId: cleanupGig1.id, professionalism: 2, punctuality: 1, quality: 2, communication: 2, comment: 'Came late, rig was not ready.' },
    { fromUserId: zoya.id, toUserId: kabir.id, gigId: cleanupGig1.id, professionalism: 2, punctuality: 2, quality: 1, communication: 2, comment: 'Missing cables, hard to reach.' },
    { fromUserId: arjun.id, toUserId: kabir.id, gigId: cleanupGig1.id, professionalism: 2, punctuality: 2, quality: 2, communication: 1, comment: 'Left early without telling anyone.' },
    { fromUserId: admin.id, toUserId: kabir.id, gigId: cleanupGig1.id, professionalism: 1, punctuality: 2, quality: 2, communication: 2, comment: 'Demo rating for the flagged-user list.' },
    { fromUserId: zoya.id, toUserId: kabir.id, gigId: cleanupGig2.id, professionalism: 2, punctuality: 2, quality: 2, communication: 2, comment: 'Second demo rating to cross the 5-rating threshold.' },
  ] });

  console.log('Seed done.');
  console.log('  admin  : admin@talentx.test / admin123');
  console.log('  users  : meera@talentx.test, arjun@talentx.test, zoya@talentx.test, kabir@talentx.test / password123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
