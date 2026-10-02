// Vercel serverless entry — the same Express app, no .listen() here.
// (server.js still does the listening for local development and Render.)
const app = require('../src/app');

module.exports = app;
