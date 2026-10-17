const { createHmac } = require('node:crypto');
function sessionToken(secret, now = Date.now()) {
  const expires = String(Math.floor(now / 1000) + 12 * 3600);
  return `${expires}.${createHmac('sha256', secret).update(`owner:${expires}`).digest('hex')}`;
}
function externalAllowed(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && ['www.instagram.com', 'developers.facebook.com', 'business.facebook.com', 'platform.openai.com', 'console.anthropic.com', 'platform.claude.com', 'ollama.com', 'github.com'].includes(u.hostname); } catch { return false; }
}
module.exports = { sessionToken, externalAllowed };
