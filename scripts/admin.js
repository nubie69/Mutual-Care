const { createStore } = require('../src/lib/store');
const { dataFile } = require('../src/config');
const username = process.argv[2];
if (!username) { console.error('Usage: npm run admin -- <registered-username> (stop the server first)'); process.exit(1); }
createStore(dataFile).update(data => {
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) throw new Error('Register this account before granting administrator access');
  user.role = 'admin';
});
console.log(`Administrator access granted to ${username}. Restart the server.`);
