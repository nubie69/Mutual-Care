const crypto = require('node:crypto');
const scrypt = require('node:util').promisify(crypto.scrypt);
const { HttpError } = require('./http');
const config = require('../config');
async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { passwordSalt: salt, passwordHash: (await scrypt(password, salt, 64)).toString('hex') };
}
async function matches(password, user) {
  const hash = await hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash.passwordHash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}
function publicUser(user) { const { passwordSalt, passwordHash, ...safe } = user; return safe; }
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function cookieToken(req) { return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('mutual_care_session='))?.split('=')[1] || ''; }
function authenticate(req, store) {
  const session = store.read().sessions.find(x => x.tokenHash === tokenHash(cookieToken(req)) && x.expiresAt > Date.now());
  const user = session && store.read().users.find(x => x.id === session.userId);
  if (!user) throw new HttpError(401, 'Please sign in to continue');
  return user;
}
function session(data, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  data.sessions = data.sessions.filter(x => x.expiresAt > Date.now());
  data.sessions.push({ tokenHash: tokenHash(token), userId, expiresAt: Date.now() + config.sessionTtl });
  return token;
}
function cookie(token, clear = false) {
  return `mutual_care_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : config.sessionTtl / 1000}${config.production ? '; Secure' : ''}`;
}
module.exports = { hashPassword, matches, publicUser, tokenHash, cookieToken, authenticate, session, cookie };
