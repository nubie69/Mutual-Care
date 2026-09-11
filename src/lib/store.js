const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
// Single-process repository. Commit the whole transaction using an atomic rename.
function createStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const key of ['users', 'activities', 'sessions', 'listings', 'requests', 'transactions']) current[key] ||= [];
  for (const user of current.users) {
    user.role ||= 'member'; user.inviteCode ||= crypto.randomBytes(6).toString('hex').toUpperCase();
    user.displayName ||= user.username; user.settings ||= { notifications: true };
  }
  function persist(data) {
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(`${file}.tmp`, file);
  }
  persist(current);
  return { read: () => current, update(fn) {
    const next = structuredClone(current); const result = fn(next);
    persist(next); current = next; return result;
  } };
}
function activity(data, userId, type, note) {
  data.activities.push({ id: crypto.randomUUID(), userId, type, note, createdAt: new Date().toISOString() });
}
module.exports = { createStore, activity };
