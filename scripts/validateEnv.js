// Lightweight env validator used by next.config.js and CI
// Do not import TS here to avoid build-time transpilation needs.
const requiredKeys = require('../config/requiredEnv.json');

function validateRequiredEnv() {
  const missing = requiredKeys.filter(
    (k) => !process.env[k] || String(process.env[k]).length === 0
  );
  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    // Throw to fail build/start in CI and local
    throw new Error(msg);
  }
}

module.exports = { validateRequiredEnv };
