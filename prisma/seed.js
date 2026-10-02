// StudioX seed data — run with: node prisma/seed.js
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
  console.log('Seeding StudioX...');

  // Wipe demo data, but preserve accounts created outside the seed
  // (e.g. Google sign-ins) so real users survive demo re-seeds.
  const keepUsers = await prisma.user.findMany({
    where: { email: { not: { endsWith: '@studiox.test' } } },
    select: { id: true },
  });
  const keepIds = keepUsers.map((u) => u.id);
  const notKeep = keepIds.length ? { userId: { notIn: keepIds } } : {};

  await prisma.dispute.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.application.deleteMany();
  await prisma.rental.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.gig.deleteMany();
  await prisma.walletTransaction.deleteMany({ where: notKeep });
  await prisma.portfolioItem.deleteMany({ where: notKeep });
  await prisma.profile.deleteMany({ where: notKeep });
  await prisma.refreshToken.deleteMany({ where: notKeep });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@studiox.test' } } });

  const password = await bcrypt.hash('password123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.create({ data: {
    name: 'StudioX Admin', email: 'admin@studiox.test', passwordHash: adminPassword,
    role: 'ADMIN', walletBalance: 50000,
    profile: { create: { discipline: 'other', city: 'Mumbai', bio: 'Platform team.' } },
  } });

  const meera = await prisma.user.create({ data: {
    name: 'Meera Kapoor', email: 'meera@studiox.test', passwordHash: password,
    walletBalance: 20000,
    profile: { create: { discipline: 'photographer', city: 'Mumbai', bio: 'Fashion and portrait photographer, 6 years experience.', dayRate: 8000, credits: 'Vogue India (2024), Lakme Fashion Week backstage, Nykaa campaigns.', gearList: 'Sony A7IV, 85mm f/1.4, 2x Godox AD200' } },
  } });

  const arjun = await prisma.user.create({ data: {
    name: 'Arjun Mehta', email: 'arjun@studiox.test', passwordHash: password,
    walletBalance: 20000,
    profile: { create: { discipline: 'model', city: 'Mumbai', bio: 'Commercial and runway model.', dayRate: 6000, credits: 'Myntra runway, Spotify India social campaigns.' } },
  } });

  const zoya = await prisma.user.create({ data: {
    name: 'Zoya Rahman', email: 'zoya@studiox.test', passwordHash: password,
    plan: 'PRO', walletBalance: 12000,
    profile: { create: { discipline: 'cinematographer', city: 'Pune', bio: 'Music videos and brand films.', dayRate: 12000, credits: 'Music videos for indie labels, two web-series pilots.' } },
  } });

  const kabir = await prisma.user.create({ data: {
    name: 'Kabir Shah', email: 'kabir@studiox.test', passwordHash: password,
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
    'STUDIOX CONTRACT', '', 'Parties: Meera Kapoor (Giver) and Arjun Mehta (Taker)',
    'Scope: Actor portfolio portraits, 4 looks, one day.', 'Date of shoot: 10 September 2026',
    'Amount: INR 10000', 'Payout rule: 50% after the shoot, 50% after delivery is approved.',
    'Escrow: full amount held by StudioX until both parts are released.',
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
    'STUDIOX CONTRACT', '', 'Parties: Meera Kapoor (Giver) and Arjun Mehta (Taker)',
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
    'STUDIOX CONTRACT', '', 'Parties: Zoya Rahman (Giver) and Arjun Mehta (Taker)',
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

  // ---- Extra creators for a fuller board ----
  const ishita = await prisma.user.create({ data: {
    name: 'Ishita Verma', email: 'ishita@studiox.test', passwordHash: password,
    plan: 'PRO', walletBalance: 12000,
    profile: { create: { discipline: 'director', city: 'Mumbai', bio: 'Ad films and short films. Big on pre-production.', dayRate: 15000, credits: 'Two festival-nominated shorts, 20+ brand films.' } },
  } });
  const rohan = await prisma.user.create({ data: {
    name: 'Rohan Iyer', email: 'rohan@studiox.test', passwordHash: password,
    walletBalance: 9000,
    profile: { create: { discipline: 'editor', city: 'Delhi', bio: 'Editor and colourist — Premiere and Resolve.', dayRate: 7000, credits: 'Docu-series for a national OTT, 100+ corporate films.' } },
  } });

  await prisma.portfolioItem.createMany({ data: [
    { userId: ishita.id, title: 'Ad film — Diwali campaign', type: 'VIDEO', url: 'https://www.youtube.com/watch?v=demo-diwal' },
    { userId: rohan.id, title: 'Colour reel 2026', type: 'VIDEO', url: 'https://www.youtube.com/watch?v=demo-colour' },
  ] });

  // ---- More open gigs ----
  const newGigs = [
    { giverId: meera.id, title: 'E-commerce catalogue day', description: '120 SKUs, plain background, our studio lights. Fast pace, steady hands.', discipline: 'photographer', city: 'Mumbai', shootDate: new Date('2026-11-03'), budget: 8000 },
    { giverId: zoya.id, title: 'Brand film — behind the scenes', description: 'BTS coverage of a two-day brand shoot. Deliver same-night selects.', discipline: 'cinematographer', city: 'Pune', shootDate: new Date('2026-11-12'), budget: 18000 },
    { giverId: kabir.id, title: 'Fashion week backstage crew', description: 'Three runways over two days. Lighting support with our kit.', discipline: 'lighting', city: 'Delhi', shootDate: new Date('2026-12-02'), budget: 15000, peopleNeeded: 3 },
    { giverId: ishita.id, title: 'Short film — assistant director', description: 'Five-day indie shoot. Scripting, scheduling and set management.', discipline: 'director', city: 'Mumbai', shootDate: new Date('2026-11-22'), budget: 20000 },
    { giverId: ishita.id, title: 'Ad shoot — storyboard artist', description: 'Storyboard a 30-second TV commercial from our script.', discipline: 'other', city: 'Mumbai', shootDate: new Date('2026-12-08'), budget: 7000 },
    { giverId: rohan.id, title: 'Podcast video edit', description: 'Two 45-minute episodes, multicam, weekly turnaround.', discipline: 'editor', city: 'Delhi', shootDate: new Date('2026-11-18'), budget: 6000 },
    { giverId: meera.id, title: 'Maternity photoshoot', description: 'Warm, natural-light session at the client home. Two outfits.', discipline: 'photographer', city: 'Mumbai', shootDate: new Date('2026-12-05'), budget: 12000 },
    { giverId: zoya.id, title: 'Music festival aftermovie', description: 'Two days, three stages. Cuts fast, colours loud.', discipline: 'cinematographer', city: 'Pune', shootDate: new Date('2026-12-15'), budget: 25000, peopleNeeded: 2 },
  ];
  for (const g of newGigs) await prisma.gig.create({ data: g });

  // Pending applications so applicant lists look alive
  const gigByTitle = async (t) => { const g = await prisma.gig.findFirst({ where: { title: t } }); return g.id; };
  const catalogue = await gigByTitle('E-commerce catalogue day');
  const fashion = await gigByTitle('Fashion week backstage crew');
  const maternity = await gigByTitle('Maternity photoshoot');
  const storyboard = await gigByTitle('Ad shoot — storyboard artist');
  const secondShooter = await gigByTitle('Second shooter — wedding');
  await prisma.application.createMany({ data: [
    { gigId: catalogue, applicantId: zoya.id, message: 'Comfortable with fast product pacing, own fast cards.' },
    { gigId: fashion, applicantId: arjun.id, message: 'Done three runway seasons, can rally a crew.' },
    { gigId: maternity, applicantId: arjun.id, message: 'Calm on set, natural-light portfolio on my profile.' },
    { gigId: storyboard, applicantId: rohan.id, message: 'I storyboard my own edits — can work to your script.' },
    { gigId: secondShooter, applicantId: ishita.id, message: 'Shooting weddings since film school. Available all day.' },
  ] });

  // ---- More gear listings ----
  const newGear = [
    { ownerId: zoya.id, name: 'DJI RS 3 gimbal', category: 'CAMERA', pricePerDay: 1200, deposit: 5000, city: 'Pune', description: 'Balanced and ready, three quick-release plates.' },
    { ownerId: meera.id, name: 'Profoto B10 flash kit', category: 'LIGHT', pricePerDay: 2000, deposit: 6000, city: 'Mumbai', description: 'Two heads, batteries and softbox modifiers.' },
    { ownerId: arjun.id, name: 'Wardrobe rack + steamer', category: 'COSTUME', pricePerDay: 500, deposit: 1000, city: 'Mumbai', description: 'Rolling rack, garment steamer, 40 hangers.' },
    { ownerId: ishita.id, name: 'Rode Wireless GO II mics', category: 'AUDIO', pricePerDay: 900, deposit: 2500, city: 'Mumbai', description: 'Two transmitters, one receiver, windshields.' },
    { ownerId: rohan.id, name: 'MacBook Pro M3 — edit station', category: 'PROP', pricePerDay: 1500, deposit: 20000, city: 'Delhi', description: 'Resolve + Premiere installed, calibrated display.' },
    { ownerId: kabir.id, name: 'Canon EOS R6 Mark II', category: 'CAMERA', pricePerDay: 2200, deposit: 9000, city: 'Delhi', description: 'Body only, dual card slots, three batteries.' },
  ];
  for (const e of newGear) await prisma.equipment.create({ data: e });

  // Existing gear rows (created with createMany) — look them back up for rentals
  const sonyA7 = await prisma.equipment.findFirst({ where: { name: 'Sony A7IV body + 24-70 f/2.8' } });
  const godoxKit = await prisma.equipment.findFirst({ where: { name: 'Godox SL-60W light kit (x2)' } });
  const profoto = await prisma.equipment.findFirst({ where: { name: 'Profoto B10 flash kit' } });
  const canonR6 = await prisma.equipment.findFirst({ where: { name: 'Canon EOS R6 Mark II' } });
  const studio = await prisma.equipment.findFirst({ where: { name: 'Home studio space, Bandra' } });
  const rode = await prisma.equipment.findFirst({ where: { name: 'Rode Wireless GO II mics' } });

  const day = 86400000;
  const ago = (d) => new Date(Date.now() - d * day);
  const ahead = (d) => new Date(Date.now() + d * day);

  // 1) PENDING — arjun requests meera's studio
  await prisma.rental.create({ data: {
    equipmentId: studio.id, renterId: arjun.id,
    startDate: ahead(34), endDate: ahead(35),
  } });

  // 2) APPROVED — zoya approved with agreement, waiting for renter to pay
  const rApproved = await prisma.rental.create({ data: {
    equipmentId: rode.id, renterId: zoya.id,
    startDate: ahead(49), endDate: ahead(51),
    status: 'APPROVED',
    agreementPdfPath: await writeUploadFile('contracts', 'seed-agreement-1.pdf', makePdf([
      'STUDIOX RENTAL AGREEMENT', '', 'Gear: Rode Wireless GO II mics', 'Renter: Zoya Rahman', 'Two days. Deposit refundable after POST inspection.',
    ])),
    rentAmount: 1800, depositAmount: 2500,
  } });
  await prisma.inspection.create({ data: { rentalId: rApproved.id, type: 'PRE', conditionScore: 5, note: 'Mics tested in front of the owner.', byUserId: zoya.id } });

  // 3) ACTIVE — arjun is shooting with kabir's Canon right now
  const rActive = await prisma.rental.create({ data: {
    equipmentId: canonR6.id, renterId: arjun.id,
    startDate: ago(1), endDate: ahead(2),
    status: 'ACTIVE', rentAmount: 6600, depositAmount: 9000,
  } });
  await prisma.payment.create({ data: { rentalId: rActive.id, amount: 15600, heldAmount: 15600, releasedAmount: 0, status: 'HELD', createdAt: ago(2) } });
  await prisma.walletTransaction.create({ data: { userId: arjun.id, amount: -15600, type: 'ESCROW_IN', referenceId: `rental:${rActive.id}`, description: 'Rent + deposit into escrow', createdAt: ago(2) } });
  await prisma.inspection.create({ data: { rentalId: rActive.id, type: 'PRE', conditionScore: 5, note: 'Shutter count low, everything sealed.', byUserId: arjun.id, createdAt: ago(1) } });

  // 4) RETURNED — happy path with inspections and ratings
  const rReturned1 = await prisma.rental.create({ data: {
    equipmentId: profoto.id, renterId: ishita.id,
    startDate: ago(14), endDate: ago(12),
    status: 'RETURNED', rentAmount: 4000, depositAmount: 6000,
  } });
  await prisma.payment.create({ data: { rentalId: rReturned1.id, amount: 10000, heldAmount: 10000, releasedAmount: 10000, status: 'RELEASED', createdAt: ago(15) } });
  await prisma.walletTransaction.createMany({ data: [
    { userId: ishita.id, amount: -10000, type: 'ESCROW_IN', referenceId: `rental:${rReturned1.id}`, description: 'Rent + deposit into escrow', createdAt: ago(15) },
    { userId: meera.id, amount: 4000, type: 'RELEASE', referenceId: `rental:${rReturned1.id}`, description: 'Rent released for the rental', createdAt: ago(12) },
    { userId: ishita.id, amount: 6000, type: 'REFUND', referenceId: `rental:${rReturned1.id}`, description: 'Deposit refunded — returned in good condition', createdAt: ago(12) },
  ] });
  await prisma.inspection.createMany({ data: [
    { rentalId: rReturned1.id, type: 'PRE', conditionScore: 5, note: 'Heads tested, all modifiers present.', byUserId: ishita.id, createdAt: ago(14) },
    { rentalId: rReturned1.id, type: 'POST', conditionScore: 5, note: 'Packed back perfectly.', byUserId: meera.id, createdAt: ago(12) },
  ] });
  await prisma.rating.createMany({ data: [
    { fromUserId: ishita.id, toUserId: meera.id, rentalId: rReturned1.id, professionalism: 5, punctuality: 5, quality: 5, communication: 5, equipmentCare: 5, comment: 'Owner was flexible with pickup times.' },
    { fromUserId: meera.id, toUserId: ishita.id, rentalId: rReturned1.id, professionalism: 5, punctuality: 5, quality: 5, communication: 4, equipmentCare: 5, comment: 'Careful and communicative renter.' },
  ] });

  // 5) RETURNED — mediocre condition, low rating keeps kabir flagged for admin review
  const rReturned2 = await prisma.rental.create({ data: {
    equipmentId: godoxKit.id, renterId: zoya.id,
    startDate: ago(22), endDate: ago(20),
    status: 'RETURNED', rentAmount: 1600, depositAmount: 3000,
  } });
  await prisma.payment.create({ data: { rentalId: rReturned2.id, amount: 4600, heldAmount: 4600, releasedAmount: 4600, status: 'RELEASED', createdAt: ago(23) } });
  await prisma.walletTransaction.createMany({ data: [
    { userId: zoya.id, amount: -4600, type: 'ESCROW_IN', referenceId: `rental:${rReturned2.id}`, description: 'Rent + deposit into escrow', createdAt: ago(23) },
    { userId: kabir.id, amount: 1600, type: 'RELEASE', referenceId: `rental:${rReturned2.id}`, description: 'Rent released for the rental', createdAt: ago(20) },
    { userId: zoya.id, amount: 3000, type: 'REFUND', referenceId: `rental:${rReturned2.id}`, description: 'Deposit refunded after POST inspection', createdAt: ago(20) },
  ] });
  await prisma.inspection.createMany({ data: [
    { rentalId: rReturned2.id, type: 'PRE', conditionScore: 4, note: 'Few scuffs as listed.', byUserId: zoya.id, createdAt: ago(22) },
    { rentalId: rReturned2.id, type: 'POST', conditionScore: 3, note: 'One bulb flickers now.', byUserId: kabir.id, createdAt: ago(20) },
  ] });
  await prisma.rating.createMany({ data: [
    { fromUserId: zoya.id, toUserId: kabir.id, rentalId: rReturned2.id, professionalism: 2, punctuality: 2, quality: 2, communication: 2, equipmentCare: 2, comment: 'Kit was not as described.' },
    { fromUserId: kabir.id, toUserId: zoya.id, rentalId: rReturned2.id, professionalism: 4, punctuality: 4, quality: 4, communication: 5, equipmentCare: 5, comment: 'Handled the pickup smoothly.' },
  ] });

  // 6) DISPUTED — kabir claims damage; admin panel shows a rental dispute
  const rDisputed = await prisma.rental.create({ data: {
    equipmentId: sonyA7.id, renterId: rohan.id,
    startDate: ago(7), endDate: ago(5),
    status: 'DISPUTED', rentAmount: 5000, depositAmount: 10000,
  } });
  await prisma.payment.create({ data: { rentalId: rDisputed.id, amount: 15000, heldAmount: 15000, releasedAmount: 0, status: 'HELD', createdAt: ago(8) } });
  await prisma.walletTransaction.create({ data: { userId: rohan.id, amount: -15000, type: 'ESCROW_IN', referenceId: `rental:${rDisputed.id}`, description: 'Rent + deposit into escrow', createdAt: ago(8) } });
  await prisma.inspection.createMany({ data: [
    { rentalId: rDisputed.id, type: 'PRE', conditionScore: 5, note: 'Clean body, no marks.', byUserId: rohan.id, createdAt: ago(8) },
    { rentalId: rDisputed.id, type: 'POST', conditionScore: 2, note: 'Cracked lens hood, visible sensor dust.', byUserId: kabir.id, createdAt: ago(4) },
  ] });
  await prisma.dispute.create({ data: {
    rentalId: rDisputed.id, raisedById: kabir.id,
    reason: 'Lens hood cracked and sensor has dust spots — renter is not responding.',
    createdAt: ago(4),
  } });

  console.log('Seed done.');
  console.log('  admin  : admin@studiox.test / admin123');
  console.log('  users  : meera@studiox.test, arjun@studiox.test, zoya@studiox.test, kabir@studiox.test / password123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
