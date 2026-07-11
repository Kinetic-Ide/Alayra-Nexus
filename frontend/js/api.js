// Admin API client. Every call carries the session's bearer token; a 401 means the
// password was rotated or revoked, so the session is dropped rather than retried. A 403
// on a mutation means a read-only (viewer) credential — surfaced as a clear message, not
// an error, since the server is enforcing exactly what the UI already signals (Phase 6.5).
import { state, logout } from './state.js';
import { toast }         from './utils.js';

async function api(method, path, body) {
  const opts = { method, headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (res.status === 401) { logout(); return null; }
  if (res.status === 403) { toast('Read-only access — that action needs an owner credential.', true); return null; }
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(t || `HTTP ${res.status}`); }
  return res.json();
}

export const GET   = p      => api('GET',    p);
export const POST  = (p, b) => api('POST',   p, b);
export const PUT   = (p, b) => api('PUT',    p, b);
export const DEL   = p      => api('DELETE', p);
export const PATCH = (p, b) => api('PATCH',  p, b);
