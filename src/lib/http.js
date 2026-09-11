class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function json(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
}
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Use application/json');
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) throw new HttpError(413, 'Request is too large');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch { throw new HttpError(400, 'Request body must be a JSON object'); }
}
function field(value, name, min = 0, max = 200) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new HttpError(400, `${name} must be ${min}–${max} characters`);
  return value.trim();
}
module.exports = { HttpError, json, body, field };
