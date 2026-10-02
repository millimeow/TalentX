require('dotenv').config();

const app = require('./src/app');
const { checkAutoReleases } = require('./src/utils/autoRelease');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`StudioX running on http://localhost:${PORT}`);

  // Auto-release job: on start and every hour
  checkAutoReleases().catch((err) => console.error('[auto-release] error:', err.message));
  setInterval(() => {
    checkAutoReleases().catch((err) => console.error('[auto-release] error:', err.message));
  }, 60 * 60 * 1000);
});
