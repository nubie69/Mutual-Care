import { api } from './api.js';
const root = document.querySelector('#workspace');
const page = location.pathname.split('/').pop().replace('.html', '') || 'dashboard';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const date = value => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
let state;
const empty = message => `<div class="empty-state"><span class="empty-mark">✦</span><p>${message}</p></div>`;
const panel = (title, content) => `<section class="workspace-card"><h2>${title}</h2>${content}</section>`;
const stat = (label, value, note) => `<article class="stat-card"><span class="stat-label">${label}</span><strong class="stat-value">${escape(value)}</strong><p>${note}</p></article>`;
const button = (text, attributes = '') => `<button class="button button-secondary" ${attributes}>${text}</button>`;
const input = (name, label, value = '', type = 'text', extra = '') => `<label class="workspace-field"><span>${label}</span><input name="${name}" type="${type}" value="${escape(value)}" ${extra}></label>`;
function activities(items) {
  return items.length ? `<div class="activity-list">${items.map(a => `<article class="activity-row"><div><strong>${escape(a.note)}</strong><p>${date(a.createdAt)}</p></div><span class="status-pill">${escape(a.type)}</span></article>`).join('')}</div>` : empty('Your account updates will appear here.');
}
function requestList() {
  return state.requests.length ? state.requests.map(r => {
    const seller = r.sellerId === state.user.id;
    const actions = r.status === 'pending' ? (seller ? ['accepted', 'declined'] : ['cancelled']) : r.status === 'accepted' ? (seller ? ['completed'] : ['cancelled']) : [];
    const labels = { accepted: 'Accept', declined: 'Decline', cancelled: 'Cancel request', completed: 'Mark completed' };
    return `<article class="request-row"><div><span class="dashboard-kicker">${seller ? 'Incoming request' : 'Your request'}</span><h3>${escape(r.title)}</h3><p>${escape(r.note) || 'No additional note'} · ${money(r.priceCents)}</p><small>${date(r.createdAt)}</small></div><div class="row-actions"><span class="status-pill">${escape(r.status)}</span>${actions.map(s => button(labels[s], `data-request="${r.id}" data-status="${s}"`)).join('')}</div></article>`;
  }).join('') : empty('No requests yet. Explore the marketplace to get started.');
}
function listings(items, admin = false) {
  return items.length ? `<div class="listing-grid">${items.map(l => `<article class="listing-card"><span class="dashboard-kicker">${escape(l.sellerName)} · ${l.active ? 'Available' : 'Paused'}</span><h3>${escape(l.title)}</h3><p>${escape(l.description)}</p><strong class="listing-price">${money(l.priceCents)}</strong>${l.sellerId === state.user.id || admin ? button(l.active ? 'Pause listing' : 'Publish listing', `data-listing="${l.id}" data-active="${!l.active}"`) : `<form data-form="request"><input type="hidden" name="listingId" value="${l.id}">${input('note', 'Message to seller', '', 'text', 'maxlength="500" placeholder="Optional details"')}<button class="button button-primary">Request this offer</button></form>`}</article>`).join('')}</div>` : empty('No offers yet. Publish the first listing for your community.');
}
function content() {
  const u = state.user;
  if (page === 'dashboard') return `<div class="dashboard-stats">${stat('Care Wallet', money(state.wallet.balanceCents), 'Recorded balance')}${stat('Open Requests', state.requests.filter(r => ['pending', 'accepted'].includes(r.status)).length, 'Marketplace conversations')}${stat('Your Listings', state.listings.filter(l => l.sellerId === u.id && l.active).length, 'Active community offers')}${stat('Referrals', state.referrals.length, 'Members you invited')}</div><div class="workspace-columns">${panel('Latest account updates', activities(state.activities.slice(0, 6)))}${panel('Grow your community', `<p>Invite someone to discover Mutual Care.</p><strong class="invite-code">${escape(u.inviteCode)}</strong>${button('Copy invite link', 'data-copy')}<a class="text-link" href="/merchant.html">Explore the marketplace →</a>`)}</div>`;
  if (page === 'merchant') return panel('Community marketplace', `<p>Discover local offers and send a request directly to the seller. Requests do not charge your wallet.</p>${input('search', 'Search offers', '', 'search', 'id="listing-search" placeholder="Search by title or description"')}<div id="listing-results">${listings(state.listings)}</div>`) + panel('Publish an offer', `<form data-form="listing" class="workspace-form">${input('title', 'Offer title', '', 'text', 'required minlength="3" maxlength="100"')}${input('price', 'Price (USD)', '', 'number', 'required min="0.01" max="1000000" step="0.01"')}<label class="workspace-field full"><span>Description</span><textarea name="description" required minlength="10" maxlength="2000" rows="4"></textarea></label><button class="button button-primary">Publish listing</button></form>`);
  if (page === 'activity') return panel('Marketplace requests', requestList()) + panel('Account history', activities(state.activities));
  if (page === 'wallet') return `<div class="dashboard-stats">${stat('Available balance', money(state.wallet.balanceCents), 'USD ledger balance')}${stat('Transactions', state.wallet.transactions.length, 'Recorded wallet entries')}</div>${panel('Wallet activity', `<p>Payment processing is not connected. Deposits, withdrawals, and paid checkout are unavailable.</p>${state.wallet.transactions.length ? state.wallet.transactions.map(t => `<article class="activity-row"><span>${escape(t.note)}</span><strong>${money(t.amountCents)}</strong></article>`).join('') : empty('No transactions have been recorded.')}`)}`;
  if (page === 'referrals') return panel('Your invitation', `<p>Share this link. New members who register with your code will appear below.</p><strong class="invite-code">${escape(u.inviteCode)}</strong>${button('Copy invite link', 'data-copy')}`) + panel(`Your community · ${state.referrals.length}`, state.referrals.length ? state.referrals.map(r => `<article class="activity-row"><strong>@${escape(r.username)}</strong><span>Joined ${date(r.joinedAt)}</span></article>`).join('') : empty('Your first referral starts with an invitation.'));
  if (page === 'profile') return panel('Personal information', `<form data-form="profile" class="workspace-form">${input('displayName', 'Full name', u.displayName, 'text', 'required maxlength="80"')}${input('mobile', 'Mobile number', u.mobile, 'tel', 'required maxlength="25"')}${input('email', 'Email address', u.email, 'email', 'maxlength="120"')}${input('address', 'Address', u.address, 'text', 'maxlength="300"')}<label class="workspace-field full"><span>About you</span><textarea name="bio" maxlength="1000" rows="5">${escape(u.bio)}</textarea></label><button class="button button-primary">Save profile</button></form>`);
  if (page === 'settings') return panel('Preferences', `<form data-form="settings"><label class="check-label"><input type="checkbox" name="notifications" ${u.settings.notifications ? 'checked' : ''}> Save my preference for community notifications</label><p>This preference is saved to your account. Email delivery is not connected yet.</p><button class="button button-primary">Save preferences</button></form>`) + panel('Change password', `<p>Changing your password signs out all your devices.</p><form data-form="password" class="workspace-form">${input('currentPassword', 'Current password', '', 'password', 'required autocomplete="current-password"')}${input('password', 'New password', '', 'password', 'required minlength="8" maxlength="128" autocomplete="new-password"')}${input('confirmPassword', 'Confirm new password', '', 'password', 'required minlength="8" maxlength="128" autocomplete="new-password"')}<div class="full"><button class="button button-primary">Update password</button></div></form>`);
  if (page === 'access') return panel('Account access', `<div class="detail-grid"><span>Username</span><strong>@${escape(u.username)}</strong><span>Role</span><strong>${escape(u.role)}</strong><span>Member since</span><strong>${date(u.joinedAt)}</strong><span>Member ID</span><strong>${escape(u.id)}</strong></div><p>Your account can publish offers, send marketplace requests, and invite members.</p><a href="/profile.html" class="button button-secondary">Update your profile</a>`);
  return '';
}
function status(message, error = false) {
  const el = document.querySelector('#workspace-status');
  el.textContent = message; el.className = `workspace-status ${error ? 'error' : ''}`;
}
async function render() {
  state = await api('/workspace');
  const titles = { dashboard: `Hello, ${state.user.displayName}`, merchant: 'Your community marketplace', wallet: 'Care Wallet', activity: 'Activity & requests', referrals: 'Better, together', profile: 'Your profile', settings: 'Account settings', access: 'Your membership', admin: 'Administration' };
  document.querySelectorAll('.dashboard-nav-item').forEach(a => { a.classList.toggle('active', a.getAttribute('href')?.endsWith(`${page}.html`)); if (a.classList.contains('active')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (state.user.role === 'admin' && !document.querySelector('[data-admin-nav]')) {
    const a = document.createElement('a'); a.href = '/admin.html'; a.textContent = 'Administration'; a.className = 'dashboard-nav-item'; a.dataset.adminNav = ''; document.querySelector('.dashboard-nav').append(a);
  }
  let view = content();
  if (page === 'admin') {
    if (state.user.role !== 'admin') view = panel('Access restricted', '<p>This area requires an administrator account.</p>');
    else {
      const admin = await api('/admin');
      view = `<div class="dashboard-stats">${stat('Members', admin.users.length, 'Registered accounts')}${stat('Listings', admin.listings.length, 'Community offers')}${stat('Requests', admin.requests.length, 'Marketplace requests')}</div>` + panel('Members', `<div class="table-scroll"><table><thead><tr><th>Member</th><th>Role</th><th>Joined</th></tr></thead><tbody>${admin.users.map(u => `<tr><td>${escape(u.displayName)}<br><small>@${escape(u.username)}</small></td><td>${escape(u.role)}</td><td>${date(u.joinedAt)}</td></tr>`).join('')}</tbody></table></div>`) + panel('Manage listings', listings(admin.listings, true)) + panel('Platform activity', activities(admin.activities));
    }
  }
  root.innerHTML = `<section class="workspace"><header class="workspace-header"><div><span class="dashboard-kicker">Mutual Care / Member space</span><h1>${escape(titles[page] || 'Member space')}</h1><p>A little care. A stronger community.</p></div><a class="member-chip" href="/profile.html"><span>${escape(state.user.displayName.charAt(0).toUpperCase())}</span>@${escape(state.user.username)}</a></header><div id="workspace-status" role="status" aria-live="polite"></div>${view}<footer class="workspace-footer">Mutual Care · Built around community</footer></section>`;
}
root.addEventListener('submit', async event => {
  const form = event.target.closest('[data-form]'); if (!form) return;
  event.preventDefault(); const submit = event.submitter; submit.disabled = true;
  const values = Object.fromEntries(new FormData(form));
  try {
    const kind = form.dataset.form;
    if (kind === 'profile') await api('/profile', { method: 'PATCH', body: values });
    if (kind === 'listing') await api('/listings', { method: 'POST', body: { ...values, priceCents: Math.round(Number(values.price) * 100) } });
    if (kind === 'request') await api('/requests', { method: 'POST', body: values });
    if (kind === 'settings') await api('/settings', { method: 'PATCH', body: { notifications: form.elements.notifications.checked } });
    if (kind === 'password') {
      if (values.password !== values.confirmPassword) throw new Error('Passwords do not match');
      await api('/auth/password', { method: 'POST', body: values }); location.assign('/index.html#auth-panel'); return;
    }
    await render(); status(kind === 'request' ? 'Request sent. Track its progress in Activity.' : 'Changes saved.');
  } catch (error) { status(error.message, true); } finally { submit.disabled = false; }
});
root.addEventListener('input', event => {
  if (event.target.id !== 'listing-search') return;
  const query = event.target.value.toLowerCase();
  document.querySelector('#listing-results').innerHTML = listings(state.listings.filter(l => `${l.title} ${l.description}`.toLowerCase().includes(query)));
});
root.addEventListener('click', async event => {
  const target = event.target.closest('button'); if (!target) return;
  try {
    if (target.hasAttribute('data-copy')) {
      await navigator.clipboard.writeText(`${location.origin}/registration.html?ref=${encodeURIComponent(state.user.inviteCode)}`); status('Invite link copied.'); return;
    }
    if (!target.dataset.listing && !target.dataset.request) return;
    target.disabled = true;
    if (target.dataset.listing) await api(`/listings/${target.dataset.listing}`, { method: 'PATCH', body: { active: target.dataset.active === 'true' } });
    if (target.dataset.request) await api(`/requests/${target.dataset.request}`, { method: 'PATCH', body: { status: target.dataset.status } });
    await render(); status('Changes saved.');
  } catch (error) { status(error.message, true); } finally { target.disabled = false; }
});
document.querySelectorAll('.logout').forEach(link => link.addEventListener('click', async event => {
  event.preventDefault(); try { await api('/auth/logout', { method: 'POST' }); location.assign('/index.html'); } catch (error) { status(error.message, true); }
}));
render().catch(error => { root.innerHTML = `<section class="workspace"><h1>Unable to load your workspace</h1><p>${escape(error.message)}</p><a class="button button-primary" href="${escape(location.pathname)}">Try again</a></section>`; });
