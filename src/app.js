const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { createStore } = require('./lib/store');
const { json, HttpError } = require('./lib/http');
const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspace');
function createApp({ dataFile = config.dataFile } = {}) {
  const store = createStore(dataFile); const attempts = new Map();
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'same-origin');
    try {
      const url = new URL(req.url, 'http://localhost'); const route = `${req.method} ${url.pathname}`;
      if (url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(req.method)) {
          if (req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Cross-site requests are not allowed');
          if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new HttpError(403, 'Origin is not allowed');
        }
        if (['POST /api/auth/login', 'POST /api/auth/register'].includes(route)) {
          const now = Date.now();
          for (const [key, value] of attempts) if (value.expires < now) attempts.delete(key);
          const key = req.socket.remoteAddress; const entry = attempts.get(key) || { count: 0, expires: now + 900000 };
          if (++entry.count > 30) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
          attempts.set(key, entry);
        }
        if (route === 'GET /api/health') return json(res, 200, { status: 'ok' });
        if (url.pathname.startsWith('/api/auth/')) return await authRoutes(req, res, route, store);
        return await workspaceRoutes(req, res, route, store);
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, 'Method not allowed');
      const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(config.publicDir, `.${name}`); const relative = path.relative(config.publicDir, file);
      if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p.startsWith('.'))) throw new HttpError(404, 'Page not found');
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };
      if (!types[path.extname(file)] || !fs.existsSync(file) || !fs.statSync(file).isFile()) throw new HttpError(404, 'Page not found');
      const content = await fs.promises.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'An unexpected error occurred' }); else res.end();
    }
  });
}
module.exports = { createApp };
