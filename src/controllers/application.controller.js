const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { getAveragesForUsers } = require('../utils/ratings');

// POST /gigs/:id/apply
const applyToGig = asyncHandler(async (req, res) => {
  const gigId = Number(req.params.id);
  const { message } = req.body;
  if (!message || !message.trim()) {
    throw new AppError('Please write a short message with your application.', 400);
  }

  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig) throw new AppError('Gig not found.', 404);
  if (gig.status !== 'OPEN') {
    throw new AppError('This gig is no longer open for applications.', 409);
  }
  if (gig.giverId === req.user.id) {
    throw new AppError('You cannot apply to your own gig.', 403);
  }

  const existing = await prisma.application.findUnique({
    where: { gigId_applicantId: { gigId, applicantId: req.user.id } },
  });
  if (existing) {
    throw new AppError('You already applied to this gig.', 409);
  }

  const application = await prisma.application.create({
    data: { gigId, applicantId: req.user.id, message: message.trim() },
  });

  res.status(201).json({ application });
});

// GET /gigs/:id/applications — giver only
const listApplications = asyncHandler(async (req, res) => {
  const gigId = Number(req.params.id);

  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig) throw new AppError('Gig not found.', 404);
  if (gig.giverId !== req.user.id) {
    throw new AppError('Only the giver can see the applicants for this gig.', 403);
  }

  const applications = await prisma.application.findMany({
    where: { gigId },
    include: {
      applicant: {
        select: {
          id: true, name: true, plan: true,
          profile: { select: { photoPath: true, discipline: true, city: true, dayRate: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const averages = await getAveragesForUsers(applications.map((a) => a.applicant.id));

  res.status(200).json({
    applications: applications.map((a) => ({
      ...a,
      applicantRating: averages[a.applicant.id],
    })),
  });
});

// GET /applications/mine — my applications with their gig info (dashboard)
const listMyApplications = asyncHandler(async (req, res) => {
  const applications = await prisma.application.findMany({
    where: { applicantId: req.user.id },
    include: { gig: { select: { id: true, title: true, status: true, city: true, budget: true, shootDate: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ applications });
});

// POST /applications/:id/accept — giver only; other applicants get rejected
const acceptApplication = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const application = await prisma.application.findUnique({
    where: { id },
    include: { gig: true },
  });
  if (!application) throw new AppError('Application not found.', 404);
  if (application.gig.giverId !== req.user.id) {
    throw new AppError('Only the giver can accept applications.', 403);
  }
  if (application.status !== 'PENDING') {
    throw new AppError('This application was already handled.', 409);
  }
  if (application.gig.status !== 'OPEN') {
    throw new AppError('This gig already hired someone.', 409);
  }

  const [, updated] = await prisma.$transaction([
    prisma.application.updateMany({
      where: { gigId: application.gigId, id: { not: id } },
      data: { status: 'REJECTED' },
    }),
    prisma.application.update({ where: { id }, data: { status: 'ACCEPTED' } }),
    prisma.gig.update({ where: { id: application.gigId }, data: { status: 'HIRED' } }),
  ]);

  res.status(200).json({ application: updated });
});

module.exports = { applyToGig, listApplications, acceptApplication, listMyApplications };
