const crypto = require('node:crypto');
const { body, field, json, HttpError } = require('../lib/http');
const { authenticate, publicUser } = require('../lib/auth');
const { activity } = require('../lib/store');
module.exports = async function workspaceRoutes(req, res, route, store) {
  const user = authenticate(req, store);
  const data = store.read();
  if (route === 'GET /api/workspace') {
    const requests = data.requests.filter(r => r.buyerId === user.id || r.sellerId === user.id);
    const transactions = data.transactions.filter(t => t.userId === user.id);
    return json(res, 200, {
      user: publicUser(user), listings: data.listings.filter(l => l.active || l.sellerId === user.id), requests,
      activities: data.activities.filter(a => a.userId === user.id).slice(-100).reverse(),
      referrals: data.users.filter(u => u.referredBy === user.id).map(u => ({ username: u.username, joinedAt: u.joinedAt })),
      wallet: { currency: 'USD', balanceCents: transactions.reduce((sum, t) => sum + t.amountCents, 0), transactions },
    });
  }
  if (route === 'PATCH /api/profile') {
    const input = await body(req); const changes = {};
    for (const [name, max] of [['displayName', 80], ['mobile', 25], ['email', 120], ['bio', 1000], ['address', 300]]) {
      if (input[name] !== undefined) changes[name] = field(input[name], name, ['displayName', 'mobile'].includes(name) ? 1 : 0, max);
    }
    if (changes.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) throw new HttpError(400, 'Enter a valid email address');
    if (changes.mobile && !/^\+?[\d ()-]{7,25}$/.test(changes.mobile)) throw new HttpError(400, 'Enter a valid mobile number');
    const updated = store.update(d => { const u = d.users.find(u => u.id === user.id); Object.assign(u, changes); activity(d, user.id, 'profile', 'Profile updated'); return publicUser(u); });
    return json(res, 200, { user: updated });
  }
  if (route === 'PATCH /api/settings') {
    const input = await body(req);
    if (typeof input.notifications !== 'boolean') throw new HttpError(400, 'Notifications must be true or false');
    store.update(d => { d.users.find(u => u.id === user.id).settings = { notifications: input.notifications }; });
    return json(res, 200, { ok: true });
  }
  if (route === 'POST /api/listings') {
    const input = await body(req);
    const title = field(input.title, 'Title', 3, 100); const description = field(input.description, 'Description', 10, 2000);
    if (!Number.isSafeInteger(input.priceCents) || input.priceCents < 1 || input.priceCents > 100000000) throw new HttpError(400, 'Enter a valid price');
    const listing = { id: crypto.randomUUID(), sellerId: user.id, sellerName: user.displayName, title, description, priceCents: input.priceCents, active: true, createdAt: new Date().toISOString() };
    store.update(d => { d.listings.push(listing); activity(d, user.id, 'merchant', `Published listing: ${title}`); });
    return json(res, 201, { listing });
  }
  const listingMatch = route.match(/^PATCH \/api\/listings\/([\w-]+)$/);
  if (listingMatch) {
    const input = await body(req);
    if (typeof input.active !== 'boolean') throw new HttpError(400, 'Active must be true or false');
    store.update(d => {
      const listing = d.listings.find(l => l.id === listingMatch[1]);
      if (!listing) throw new HttpError(404, 'Listing not found');
      if (listing.sellerId !== user.id && user.role !== 'admin') throw new HttpError(403, 'You cannot change this listing');
      listing.active = input.active; activity(d, user.id, 'merchant', `${input.active ? 'Published' : 'Paused'} listing: ${listing.title}`);
    });
    return json(res, 200, { ok: true });
  }
  if (route === 'POST /api/requests') {
    const input = await body(req);
    const listingId = field(input.listingId, 'Listing', 1, 50); const note = field(input.note ?? '', 'Note', 0, 500);
    const request = store.update(d => {
      const listing = d.listings.find(l => l.id === listingId && l.active);
      if (!listing) throw new HttpError(404, 'Listing is unavailable');
      if (listing.sellerId === user.id) throw new HttpError(400, 'You own this listing');
      if (d.requests.some(r => r.listingId === listingId && r.buyerId === user.id && ['pending', 'accepted'].includes(r.status))) throw new HttpError(409, 'You already have an open request for this listing');
      const r = { id: crypto.randomUUID(), listingId, title: listing.title, priceCents: listing.priceCents, buyerId: user.id, sellerId: listing.sellerId, note, status: 'pending', createdAt: new Date().toISOString() };
      d.requests.push(r);
      for (const id of [user.id, listing.sellerId]) activity(d, id, 'request', `New request: ${listing.title}`);
      return r;
    });
    return json(res, 201, { request });
  }
  const requestMatch = route.match(/^PATCH \/api\/requests\/([\w-]+)$/);
  if (requestMatch) {
    const input = await body(req);
    store.update(d => {
      const r = d.requests.find(r => r.id === requestMatch[1]);
      if (!r) throw new HttpError(404, 'Request not found');
      const seller = r.sellerId === user.id; const buyer = r.buyerId === user.id;
      if (!seller && !buyer) throw new HttpError(403, 'You cannot change this request');
      const allowed = r.status === 'pending' ? (seller ? ['accepted', 'declined'] : ['cancelled']) : r.status === 'accepted' ? (seller ? ['completed'] : ['cancelled']) : [];
      if (!allowed.includes(input.status)) throw new HttpError(409, 'This status change is not allowed');
      r.status = input.status;
      for (const id of [r.buyerId, r.sellerId]) activity(d, id, 'request', `${r.title}: ${r.status}`);
    });
    return json(res, 200, { ok: true });
  }
  if (route === 'GET /api/admin') {
    if (user.role !== 'admin') throw new HttpError(403, 'Administrator access required');
    return json(res, 200, { users: data.users.map(publicUser), listings: data.listings, requests: data.requests, activities: data.activities.slice(-100).reverse() });
  }
  throw new HttpError(404, 'API route not found');
};
