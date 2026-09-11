const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');

test('accounts, marketplace lifecycle, isolation, security, and durable sessions', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mutual-care-test-'));
  const dataFile = path.join(directory, 'store.json');
  let server;
  let base;
  async function start() {
    server = createApp({ dataFile });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { await new Promise(resolve => server.close(resolve)); }
  await start();
  t.after(async () => { await stop(); fs.rmSync(directory, { recursive: true, force: true }); });
  async function call(route, method = 'GET', body, cookie, headers = {}) {
    const res = await fetch(`${base}${route}`, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  const credentials = username => ({ username, mobile: '+639123456789', password: 'safe-password-123' });
  assert.equal((await call('/api/workspace')).status, 401);
  const alice = await call('/api/auth/register', 'POST', credentials('alice'));
  assert.equal(alice.status, 201); assert.equal(alice.data.user.passwordHash, undefined);
  const bob = await call('/api/auth/register', 'POST', { ...credentials('bob'), referralCode: alice.data.user.inviteCode });
  const carol = await call('/api/auth/register', 'POST', credentials('carol'));
  assert.equal(bob.status, 201);
  assert.equal((await call('/api/auth/register', 'POST', credentials('ALICE'))).status, 409);
  assert.equal((await call('/api/auth/register', 'POST', null)).status, 400);
  assert.equal((await call('/api/auth/login', 'POST', { username: 'alice', password: 'incorrect' })).status, 401);
  assert.equal((await call('/api/admin', 'GET', undefined, alice.cookie)).status, 403);
  assert.equal((await call('/api/profile', 'PATCH', { displayName: 'Alice Care', role: 'admin' }, alice.cookie)).status, 200);
  assert.equal((await call('/api/auth/me', 'GET', undefined, alice.cookie)).data.user.role, 'member');
  assert.equal((await call('/api/settings', 'PATCH', { notifications: false }, alice.cookie)).status, 200);
  const listing = await call('/api/listings', 'POST', { title: 'Garden support', description: 'Friendly help with your garden.', priceCents: 2500 }, alice.cookie);
  assert.equal(listing.status, 201);
  const id = listing.data.listing.id;
  assert.equal((await call(`/api/listings/${id}`, 'PATCH', { active: false }, bob.cookie)).status, 403);
  assert.equal((await call('/api/listings', 'POST', { title: 'Invalid', description: 'An invalid price example', priceCents: -5 }, alice.cookie)).status, 400);
  const request = await call('/api/requests', 'POST', { listingId: id, note: 'Saturday please' }, bob.cookie);
  assert.equal(request.status, 201);
  const requestId = request.data.request.id;
  assert.equal((await call('/api/requests', 'POST', { listingId: id }, bob.cookie)).status, 409);
  assert.equal((await call(`/api/requests/${requestId}`, 'PATCH', { status: 'accepted' }, carol.cookie)).status, 403);
  assert.equal((await call(`/api/requests/${requestId}`, 'PATCH', { status: 'accepted' }, bob.cookie)).status, 409);
  assert.equal((await call(`/api/requests/${requestId}`, 'PATCH', { status: 'accepted' }, alice.cookie)).status, 200);
  assert.equal((await call(`/api/requests/${requestId}`, 'PATCH', { status: 'completed' }, alice.cookie)).status, 200);
  assert.equal((await call(`/api/requests/${requestId}`, 'PATCH', { status: 'accepted' }, alice.cookie)).status, 409);
  const own = await call('/api/workspace', 'GET', undefined, alice.cookie);
  assert.equal(own.data.referrals.length, 1); assert.equal(own.data.wallet.balanceCents, 0);
  assert.equal(own.data.user.settings.notifications, false);
  assert.equal((await call('/api/workspace', 'GET', undefined, carol.cookie)).data.requests.length, 0);
  assert.equal((await call('/api/profile', 'PATCH', { bio: 'Blocked' }, alice.cookie, { Origin: 'https://evil.example' })).status, 403);
  for (const file of ['/data/store.json', '/server.js', '/src/app.js', '/.git/config', '/assets/../../data/store.json', '/assets/%2e%2e%5c%2e%2e%5cdata/store.json']) assert.equal((await fetch(base + file)).status, 404, file);
  for (const file of ['/', '/registration.html', '/dashboard.html', '/admin.html', '/assets/css/styles.css', '/assets/js/workspace.js', '/assets/images/mutualcare_Logo.png']) assert.equal((await fetch(base + file)).status, 200, file);
  // Two asynchronous password hashes must not cause one registration to overwrite another.
  const concurrent = await Promise.all(['david', 'elena'].map(name => call('/api/auth/register', 'POST', credentials(name))));
  assert.ok(concurrent.every(r => r.status === 201));
  await stop(); await start();
  assert.equal((await call('/api/workspace', 'GET', undefined, alice.cookie)).data.requests[0].status, 'completed');
  for (const account of concurrent) assert.equal((await call('/api/auth/me', 'GET', undefined, account.cookie)).status, 200);
  await stop();
  const data = JSON.parse(fs.readFileSync(dataFile)); data.users.find(u => u.username === 'alice').role = 'admin'; fs.writeFileSync(dataFile, JSON.stringify(data));
  await start();
  assert.equal((await call('/api/admin', 'GET', undefined, alice.cookie)).status, 200);
  assert.equal((await call('/api/auth/password', 'POST', { currentPassword: 'safe-password-123', password: 'new-safe-password' }, bob.cookie)).status, 200);
  assert.equal((await call('/api/auth/me', 'GET', undefined, bob.cookie)).status, 401);
  assert.equal((await call('/api/auth/login', 'POST', { username: 'bob', password: 'new-safe-password' })).status, 200);
  await call('/api/auth/logout', 'POST', undefined, alice.cookie);
  assert.equal((await call('/api/auth/me', 'GET', undefined, alice.cookie)).status, 401);
  const stored = fs.readFileSync(dataFile, 'utf8');
  assert.ok(!stored.includes('safe-password')); assert.ok(!stored.includes(carol.cookie.split('=')[1]));
});
