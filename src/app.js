const express = require('express');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const userRoutes = require('./routes/user.routes');
const portfolioRoutes = require('./routes/portfolio.routes');
const gigRoutes = require('./routes/gig.routes');
const applicationRoutes = require('./routes/application.routes');
const contractRoutes = require('./routes/contract.routes');
const walletRoutes = require('./routes/wallet.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const rentalRoutes = require('./routes/rental.routes');
const inspectionRoutes = require('./routes/inspection.routes');
const ratingRoutes = require('./routes/rating.routes');
const disputeRoutes = require('./routes/dispute.routes');
const planRoutes = require('./routes/plan.routes');
const adminRoutes = require('./routes/admin.routes');
const jobsRoutes = require('./routes/jobs.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

// Uploads: photos and deliverables are public files.
// uploads/contracts is NOT here on purpose — contract PDFs are only served
// through GET /api/v1/contracts/:id/pdf after an ownership check.
const { UPLOADS_DIR } = require('./middleware/uploadImage');
app.use('/uploads/photos', express.static(path.join(UPLOADS_DIR, 'photos')));
app.use('/uploads/deliverables', express.static(path.join(UPLOADS_DIR, 'deliverables')));

// Frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'pages', 'index.html'));
});

// API v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1', portfolioRoutes);
app.use('/api/v1/gigs', gigRoutes);
app.use('/api/v1', applicationRoutes);
app.use('/api/v1/contracts', contractRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/equipment', equipmentRoutes);
app.use('/api/v1/rentals', rentalRoutes);
app.use('/api/v1/rentals', inspectionRoutes);
app.use('/api/v1', ratingRoutes);
app.use('/api/v1', disputeRoutes);
app.use('/api/v1/plans', planRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/jobs', jobsRoutes);

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found.', statusCode: 404 });
});

// Central error handler — must be last
app.use(errorHandler);

module.exports = app;
