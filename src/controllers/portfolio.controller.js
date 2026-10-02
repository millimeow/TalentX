const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../utils/prisma');
const { saveUpload } = require('../utils/storage');

// POST /portfolio (multipart with photo, or JSON with a video url)
const addPortfolioItem = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title) throw new AppError('Title is required.', 400);

  let data;
  if (req.file) {
    // Photo item — persisted by the storage layer (blob on Vercel, disk locally)
    const filePath = await saveUpload(req.file, 'photos');
    data = { title, type: 'PHOTO', filePath };
  } else if (req.body.url) {
    const url = req.body.url;
    if (!/^https?:\/\//.test(url)) {
      throw new AppError('Video links must start with http:// or https://', 400);
    }
    data = { title, type: 'VIDEO', url };
  } else {
    throw new AppError('Upload a photo file or provide a video link.', 400);
  }

  const item = await prisma.portfolioItem.create({
    data: { userId: req.user.id, ...data },
  });

  res.status(201).json({ item });
});

// GET /users/:id/portfolio
const getUserPortfolio = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) throw new AppError('Invalid user id.', 400);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found.', 404);

  const items = await prisma.portfolioItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ items });
});

// DELETE /portfolio/:id
const deletePortfolioItem = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError('Invalid portfolio item id.', 400);

  const item = await prisma.portfolioItem.findUnique({ where: { id } });
  if (!item) throw new AppError('Portfolio item not found.', 404);
  if (item.userId !== req.user.id) {
    throw new AppError('You can only delete your own portfolio items.', 403);
  }

  await prisma.portfolioItem.delete({ where: { id } });
  res.status(200).json({ message: 'Portfolio item deleted.' });
});

module.exports = { addPortfolioItem, getUserPortfolio, deletePortfolioItem };
