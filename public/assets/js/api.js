export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) location.replace('/index.html#auth-panel');
    throw new Error(data.error || 'Unable to complete the request');
  }
  return data;
}
