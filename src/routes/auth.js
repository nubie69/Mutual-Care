const crypto = require('node:crypto');
const { body, field, json, HttpError } = require('../lib/http');
const auth = require('../lib/auth');
const { activity } = require('../lib/store');
module.exports = async function authRoutes(req, res, route, store) {
  if (route === 'POST /api/auth/register') {
    const input = await body(req);
    const username = field(input.username, 'Username', 3, 30);
    if (!/^[a-zA-Z0-9_]+$/.test(username)) throw new HttpError(400, 'Username can contain letters, numbers, and underscores');
    const mobile = field(input.mobile, 'Mobile', 7, 25);
    if (!/^\+?[\d ()-]{7,25}$/.test(mobile)) throw new HttpError(400, 'Enter a valid mobile number');
    field(input.password, 'Password', 8, 128);
    const code = field(input.referralCode ?? '', 'Referral code', 0, 30).toUpperCase();
    const credentials = await auth.hashPassword(input.password);
    const result = store.update(data => {
      if (data.users.some(u => u.username.toLowerCase() === username.toLowerCase())) throw new HttpError(409, 'That username is already registered');
      const referrer = code && data.users.find(u => u.inviteCode === code);
      if (code && !referrer) throw new HttpError(400, 'Referral code was not found');
      const user = { id: crypto.randomUUID(), username, displayName: username, mobile, email: '', bio: '', address: '', role: 'member', inviteCode: crypto.randomBytes(6).toString('hex').toUpperCase(), referredBy: referrer?.id || null, joinedAt: new Date().toISOString(), settings: { notifications: true }, ...credentials };
      data.users.push(user); activity(data, user.id, 'account', 'Account created');
      if (referrer) activity(data, referrer.id, 'referral', 'A member joined with your invite code');
      return { user: auth.publicUser(user), token: auth.session(data, user.id) };
    });
    return json(res, 201, { user: result.user }, { 'Set-Cookie': auth.cookie(result.token) });
  }
  if (route === 'POST /api/auth/login') {
    const input = await body(req);
    const username = field(input.username, 'Username', 1, 30); field(input.password, 'Password', 1, 128);
    const user = store.read().users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user || !await auth.matches(input.password, user)) throw new HttpError(401, 'Invalid username or password');
    const token = store.update(data => {
      if (data.users.find(u => u.id === user.id).passwordHash !== user.passwordHash) throw new HttpError(401, 'Please sign in again');
      return auth.session(data, user.id);
    });
    return json(res, 200, { user: auth.publicUser(user) }, { 'Set-Cookie': auth.cookie(token) });
  }
  if (route === 'POST /api/auth/logout') {
    store.update(data => { data.sessions = data.sessions.filter(s => s.tokenHash !== auth.tokenHash(auth.cookieToken(req))); });
    return json(res, 200, { ok: true }, { 'Set-Cookie': auth.cookie('', true) });
  }
  const user = auth.authenticate(req, store);
  if (route === 'GET /api/auth/me') return json(res, 200, { user: auth.publicUser(user) });
  if (route === 'POST /api/auth/password') {
    const input = await body(req);
    field(input.currentPassword, 'Current password', 1, 128); field(input.password, 'New password', 8, 128);
    if (!await auth.matches(input.currentPassword, user)) throw new HttpError(400, 'Current password is incorrect');
    const credentials = await auth.hashPassword(input.password);
    store.update(data => {
      const current = data.users.find(u => u.id === user.id);
      if (current.passwordHash !== user.passwordHash) throw new HttpError(409, 'Password changed; sign in again');
      Object.assign(current, credentials); data.sessions = data.sessions.filter(s => s.userId !== user.id);
      activity(data, user.id, 'security', 'Password changed; all sessions signed out');
    });
    return json(res, 200, { ok: true }, { 'Set-Cookie': auth.cookie('', true) });
  }
  throw new HttpError(404, 'API route not found');
};
