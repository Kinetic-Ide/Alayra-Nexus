// Settings tab — API key, SSRF policy, guardrails, cost routing, response cache,
// notifications, and compliance/audit (Phase 6.7).
import { GET, PUT, POST } from '../api.js';
import { toast, esc } from '../utils.js';
import { loadConnect } from './connect.js';

async function loadSettings() {
  if (window._demoMode) return;
  try {
    const cfg = await GET('/admin/config');
    document.getElementById('settings-key-raw').value = cfg.nexusApiKey || '';
    document.getElementById('settings-key').textContent = (cfg.nexusApiKey||'').slice(0,8)+'••••••••';
  } catch {}
  try {
    const ssrf = await GET('/admin/settings/ssrf');
    document.getElementById('ssrf-allow-private').checked = !!ssrf.allowPrivate;
    document.getElementById('ssrf-allowlist').value = (ssrf.allowList||[]).join('\n');
    const env = ssrf.envAllowList||[];
    document.getElementById('ssrf-env-hint').textContent = env.length
      ? 'Also allowed via environment (read-only): ' + env.join(', ')
      : '';
  } catch {}
  loadGuardrails();
  loadRouting();
  loadCache();
  loadNotifications();
  loadCompliance();
  loadAudit();
}

const NOTIFY_EVENTS = ['keyBanned', 'breakerOpened', 'adminLockout', 'budgetThreshold', 'tierExhausted'];

async function loadNotifications() {
  if (window._demoMode) return;
  try {
    const n = await GET('/admin/settings/notifications');
    document.getElementById('notify-enabled').checked = !!n.enabled;
    document.getElementById('notify-from').value = n.from || '';
    document.getElementById('notify-to').value = (n.to || []).join('\n');
    document.getElementById('notify-webhook').value = n.webhookUrl || '';
    document.getElementById('notify-window').value = n.windowSeconds ?? 3600;
    // Never render the key; show its mask as the placeholder so "leave blank = keep" is clear.
    document.getElementById('notify-resend-key').value = '';
    document.getElementById('notify-resend-key').placeholder = n.resendKeySet
      ? `${n.resendKeyMasked} (leave as-is to keep saved key)`
      : 're_… (leave as-is to keep saved key)';
    for (const e of NOTIFY_EVENTS) {
      const el = document.getElementById('notify-ev-' + e);
      if (el) el.checked = n.events ? n.events[e] !== false : true;
    }
  } catch {}
}

async function saveNotifications() {
  const events = {};
  for (const e of NOTIFY_EVENTS) {
    const el = document.getElementById('notify-ev-' + e);
    events[e] = el ? el.checked : true;
  }
  const body = {
    enabled:      document.getElementById('notify-enabled').checked,
    from:         document.getElementById('notify-from').value.trim(),
    to:           document.getElementById('notify-to').value.split('\n').map(s => s.trim()).filter(Boolean),
    webhookUrl:   document.getElementById('notify-webhook').value.trim(),
    events,
    windowSeconds: parseInt(document.getElementById('notify-window').value, 10) || 3600,
  };
  // Only send the key when the operator actually typed a new one — a blank field keeps
  // the stored key (the server treats an omitted key as "unchanged").
  const typedKey = document.getElementById('notify-resend-key').value.trim();
  if (typedKey) body.resendApiKey = typedKey;
  try {
    await PUT('/admin/settings/notifications', body);
    toast('Notifications saved');
    loadNotifications();
  } catch(e) { toast(e.message, true); }
}

async function saveSsrf() {
  const allowPrivate = document.getElementById('ssrf-allow-private').checked;
  const allowList = document.getElementById('ssrf-allowlist').value
    .split('\n').map(s => s.trim()).filter(Boolean);
  try {
    await PUT('/admin/settings/ssrf', { allowPrivate, allowList });
    toast('Network settings saved');
    loadSettings();
  } catch(e) { toast(e.message, true); }
}

async function loadGuardrails() {
  if (window._demoMode) return;
  try {
    const gr = await GET('/admin/settings/guardrails');
    document.getElementById('gr-enabled').checked = !!gr.enabled;
    document.getElementById('gr-buffered').checked = !!gr.bufferedSafe;
    document.getElementById('gr-rules').value = JSON.stringify(gr.rules || [], null, 2);
  } catch {}
}

async function saveGuardrails() {
  const enabled = document.getElementById('gr-enabled').checked;
  const bufferedSafe = document.getElementById('gr-buffered').checked;
  const raw = document.getElementById('gr-rules').value.trim();
  let rules;
  try { rules = raw ? JSON.parse(raw) : []; }
  catch { toast('Rules must be valid JSON', true); return; }
  if (!Array.isArray(rules)) { toast('Rules must be a JSON array', true); return; }
  try {
    await PUT('/admin/settings/guardrails', { enabled, bufferedSafe, rules });
    toast('Guardrails saved');
    loadGuardrails();
  } catch(e) { toast(e.message, true); }
}

async function loadRouting() {
  if (window._demoMode) return;
  try {
    const r = await GET('/admin/settings/routing');
    const w = String(r.costWeight ?? 0);
    document.getElementById('cw-range').value = w;
    document.getElementById('cw-val').textContent = w;
  } catch {}
}

async function saveRouting() {
  const costWeight = parseFloat(document.getElementById('cw-range').value);
  try {
    await PUT('/admin/settings/routing', { costWeight });
    toast('Routing saved');
    loadRouting();
  } catch(e) { toast(e.message, true); }
}

async function loadCache() {
  if (window._demoMode) return;
  try {
    const c = await GET('/admin/settings/cache');
    document.getElementById('cache-enabled').checked = !!c.enabled;
    document.getElementById('cache-ttl').value = c.ttlSeconds ?? 3600;
  } catch {}
}

async function saveCache() {
  const enabled = document.getElementById('cache-enabled').checked;
  const ttlSeconds = parseInt(document.getElementById('cache-ttl').value, 10) || 3600;
  try {
    await PUT('/admin/settings/cache', { enabled, ttlSeconds });
    toast('Cache settings saved');
    loadCache();
  } catch(e) { toast(e.message, true); }
}

let keyVisible = false;
function toggleShowKey() {
  keyVisible = !keyVisible;
  const raw = document.getElementById('settings-key-raw').value;
  document.getElementById('settings-key').textContent = keyVisible ? raw : raw.slice(0,8)+'••••••••';
  document.getElementById('show-key-btn').textContent = keyVisible ? 'Hide' : 'Show';
}

async function rotateKey() {
  if (!confirm('Rotate the Nexus API key? All existing sessions will stop working.')) return;
  try {
    const r = await POST('/admin/api-key/regenerate');
    document.getElementById('settings-key-raw').value = r.key;
    document.getElementById('settings-key').textContent = r.key.slice(0,8)+'••••••••';
    keyVisible = false; toast('Key rotated'); loadConnect();
  } catch(e) { toast(e.message, true); }
}


// ── Compliance & audit (Phase 6.7) ───────────────────────────────────────────

async function loadCompliance() {
  if (window._demoMode) return;
  try {
    const c = await GET('/admin/settings/compliance');
    // Values not in the offered set still show correctly because the option is present.
    const audit = document.getElementById('audit-retention');
    const usage = document.getElementById('usage-retention');
    if (audit) audit.value = String(c.auditRetentionDays ?? 90);
    if (usage) usage.value = String(c.usageRetentionDays ?? 90);
    document.getElementById('anonymize-usage').checked = !!c.anonymizeUsage;
  } catch {}
}

async function saveCompliance() {
  const body = {
    auditRetentionDays: parseInt(document.getElementById('audit-retention').value, 10) || 0,
    usageRetentionDays: parseInt(document.getElementById('usage-retention').value, 10) || 0,
    anonymizeUsage:     document.getElementById('anonymize-usage').checked,
  };
  try {
    await PUT('/admin/settings/compliance', body);
    toast('Compliance settings saved');
    loadCompliance();
  } catch(e) { toast(e.message, true); }
}

function renderAudit(entries) {
  const box = document.getElementById('audit-list');
  if (!box) return;
  if (!entries.length) { box.textContent = 'No audit entries yet.'; return; }
  const rows = entries.map(e => {
    const when = new Date(e.createdAt).toLocaleString();
    const who  = e.actorRole + (e.actor ? ` · ${e.actor}` : '');
    const tgt  = e.target ? ` → ${e.target}` : '';
    return `<tr>
      <td style="padding:4px 8px;color:var(--muted);white-space:nowrap">${esc(when)}</td>
      <td style="padding:4px 8px"><strong>${esc(e.action)}</strong>${esc(tgt)}</td>
      <td style="padding:4px 8px">${esc(who)}</td>
      <td style="padding:4px 8px;color:var(--muted)">${esc(String(e.status))}</td>
      <td style="padding:4px 8px;color:var(--muted)">${esc(e.ip || '')}</td>
    </tr>`;
  }).join('');
  box.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="text-align:left;color:var(--muted);border-bottom:1px solid var(--border)">
      <th style="padding:4px 8px">When</th><th style="padding:4px 8px">Action</th>
      <th style="padding:4px 8px">Actor</th><th style="padding:4px 8px">Status</th><th style="padding:4px 8px">IP</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadAudit() {
  if (window._demoMode) return;
  const filter = (document.getElementById('audit-filter')?.value || '').trim();
  try {
    const q = filter ? `?action=${encodeURIComponent(filter)}&limit=100` : '?limit=100';
    const { entries } = await GET('/admin/audit' + q);
    renderAudit(entries || []);
  } catch { /* leave the current view */ }
}

export {
  loadSettings, saveSsrf, loadGuardrails, saveGuardrails, loadRouting, saveRouting,
  loadCache, saveCache, loadNotifications, saveNotifications, toggleShowKey, rotateKey,
  loadCompliance, saveCompliance, loadAudit,
};
