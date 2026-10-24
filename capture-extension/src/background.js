// Service worker: ține sesiunea activă, primește pașii (deja mascați) din content script,
// îi re-verifică (domeniu + a doua trecere de mascare), îi stochează local, exportă și face upload.
importScripts('masking.js', 'allowlist.js');

const { scrubText, scrubUrl, POLICY } = self.GGMask;
const { normalizeList, urlAllowed, matchPatterns } = self.GGAllowlist;

const SCRIPT_ID = 'gg-capture';
const AGENT_NAME = 'gitgood-capture';
const VERSION = chrome.runtime.getManifest().version;

const DEFAULT_SETTINGS = {
  allowlist: [],
  endpoint: 'http://localhost:3000/api/events',
  uploadFormat: 'events-batch', // events-batch (backend/app/api/events) | normalized (contract v1)
  apiKey: '',
  operatorLabel: '',
  valueCapture: 'masked',
  extraSelectors: [],
  showIndicator: true,
  retentionDays: 7,
};

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return Object.assign({}, DEFAULT_SETTINGS, settings || {});
}

// Toate scrierile în storage trec printr-o coadă, ca pașii veniți rapid să nu se suprascrie.
let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function getIndex() {
  const { sessions } = await chrome.storage.local.get('sessions');
  return sessions || [];
}

async function saveIndexEntry(entry) {
  const sessions = await getIndex();
  const i = sessions.findIndex((s) => s.id === entry.id);
  if (i >= 0) sessions[i] = Object.assign(sessions[i], entry);
  else sessions.unshift(entry);
  await chrome.storage.local.set({ sessions });
}

function stepsKey(id) {
  return 'steps:' + id;
}

// ---------- content scripts pe allowlist ----------

async function grantedEntries(list) {
  const out = [];
  for (const entry of list) {
    if (await chrome.permissions.contains({ origins: matchPatterns(entry) })) out.push(entry);
  }
  return out;
}

async function syncContentScripts() {
  const settings = await getSettings();
  const entries = await grantedEntries(settings.allowlist);
  try { await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }); } catch (_) { /* nu era înregistrat */ }
  if (!entries.length) return;
  await chrome.scripting.registerContentScripts([{
    id: SCRIPT_ID,
    matches: entries.flatMap(matchPatterns),
    js: ['src/masking.js', 'src/allowlist.js', 'src/content.js'],
    runAt: 'document_idle',
    allFrames: false,
    persistAcrossSessions: true,
  }]);
}

// Taburile deschise înainte de pornirea sesiunii nu au content script-ul; îl injectăm acum.
async function injectIntoOpenTabs() {
  const settings = await getSettings();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url || !urlAllowed(tab.url, settings.allowlist)) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/masking.js', 'src/allowlist.js', 'src/content.js'],
      });
    } catch (_) { /* fără permisiune pentru tab sau pagină specială */ }
  }
}

// ---------- sesiuni ----------

async function startSession(ticket) {
  const externalId = String(ticket && ticket.external_id || '').trim();
  if (!externalId) throw new Error('ID-ul tichetului e obligatoriu.');
  const settings = await getSettings();
  if (!settings.allowlist.length) throw new Error('Allowlist-ul e gol. Adaugă cel puțin un domeniu.');
  const { activeSession } = await chrome.storage.local.get('activeSession');
  if (activeSession) throw new Error('Există deja o sesiune activă.');

  const title = ticket.title ? scrubText(String(ticket.title).slice(0, 300)).text : null;
  const url = ticket.url ? scrubUrl(String(ticket.url).slice(0, 2048)).text : null;
  const session = {
    id: crypto.randomUUID(),
    ticket: { external_id: externalId.slice(0, 120), system: ticket.system || 'other', title, url },
    started_at: new Date().toISOString(),
    ended_at: null,
    status: 'active',
    allowlist: settings.allowlist.slice(),
    value_capture: settings.valueCapture,
    step_count: 0,
  };
  await serial(async () => {
    await chrome.storage.local.set({ activeSession: session, [stepsKey(session.id)]: [] });
    await saveIndexEntry(indexEntry(session));
  });
  await syncContentScripts();
  await injectIntoOpenTabs();
  await updateBadge();
  return session;
}

function indexEntry(session) {
  return {
    id: session.id,
    ticket: session.ticket,
    started_at: session.started_at,
    ended_at: session.ended_at,
    status: session.status,
    step_count: session.step_count,
    upload: session.upload || null,
  };
}

async function stopSession(status) {
  const session = await serial(async () => {
    const { activeSession } = await chrome.storage.local.get('activeSession');
    if (!activeSession) return null;
    activeSession.status = status === 'aborted' ? 'aborted' : 'completed';
    activeSession.ended_at = new Date().toISOString();
    await chrome.storage.local.set({ ['session:' + activeSession.id]: activeSession });
    await chrome.storage.local.remove('activeSession');
    await saveIndexEntry(indexEntry(activeSession));
    return activeSession;
  });
  await updateBadge();
  return session;
}

async function loadSession(id) {
  const { activeSession } = await chrome.storage.local.get('activeSession');
  if (activeSession && activeSession.id === id) return activeSession;
  const data = await chrome.storage.local.get('session:' + id);
  return data['session:' + id] || null;
}

// A doua trecere de mascare: nu ne bazăm pe faptul că pagina n-a modificat content script-ul.
function rescrub(value) {
  if (typeof value === 'string') return scrubText(value);
  return { text: value, reasons: [] };
}

const STEP_TYPES = new Set(['navigation', 'click', 'input', 'select', 'toggle', 'submit', 'keypress']);

function sanitizeStep(raw, tabUrl) {
  if (!raw || !STEP_TYPES.has(raw.type)) return null;
  const reasons = new Set(Array.isArray(raw.mask_reasons) ? raw.mask_reasons.map(String) : []);
  const s = (v, n) => {
    if (v == null) return null;
    const r = rescrub(String(v).slice(0, n));
    r.reasons.forEach((x) => reasons.add(x));
    return r.text;
  };
  const url = scrubUrl(tabUrl);
  url.reasons.forEach((x) => reasons.add(x));
  const t = raw.target;
  const target = t && typeof t === 'object' ? {
    tag: String(t.tag || '').slice(0, 30),
    role: s(t.role, 40),
    input_type: s(t.input_type, 30),
    label: s(t.label, 120),
    text: s(t.text, 120),
    selector: s(t.selector, 300),
    name: s(t.name, 80),
  } : null;
  let value = raw.value;
  if (typeof value === 'string') value = s(value, 500);
  else if (typeof value !== 'boolean') value = null;
  return {
    ts: typeof raw.ts === 'string' ? raw.ts : new Date().toISOString(),
    type: raw.type,
    evidence_state: 'observed',
    app: { domain: new URL(tabUrl).hostname, url: url.text, title: s(raw.app && raw.app.title, 200) },
    target,
    value,
    masked: reasons.size > 0,
    mask_reasons: Array.from(reasons),
    description: s(raw.description, 300) || raw.type,
    field_masked: !!raw.field_masked,
  };
}

async function recordStep(raw, sender) {
  const tabUrl = sender.tab && sender.tab.url;
  if (!tabUrl || sender.frameId !== 0) return { ok: false };
  return serial(async () => {
    const { activeSession } = await chrome.storage.local.get('activeSession');
    if (!activeSession || !urlAllowed(tabUrl, activeSession.allowlist)) return { ok: false };
    const step = sanitizeStep(raw, tabUrl);
    if (!step) return { ok: false };
    const key = stepsKey(activeSession.id);
    const data = await chrome.storage.local.get(key);
    const steps = data[key] || [];
    // Dedup: o navigare identică imediat după alta (reîncărcare de content script).
    const prev = steps[steps.length - 1];
    if (prev && step.type === 'navigation' && prev.type === 'navigation' && prev.app.url === step.app.url) return { ok: true };
    step.id = crypto.randomUUID();
    step.seq = steps.length + 1;
    steps.push(step);
    activeSession.step_count = steps.length;
    await chrome.storage.local.set({ [key]: steps, activeSession });
    return { ok: true, seq: step.seq };
  });
}

// ---------- export în schema normalizată ----------

async function buildPayload(id) {
  const session = await loadSession(id);
  if (!session) throw new Error('Sesiunea nu există.');
  const settings = await getSettings();
  const data = await chrome.storage.local.get(stepsKey(id));
  const rawSteps = data[stepsKey(id)] || [];
  const redactions = {};
  let maskedFields = 0;
  const steps = rawSteps.map((st) => {
    st.mask_reasons.forEach((r) => { redactions[r] = (redactions[r] || 0) + 1; });
    if (st.field_masked) maskedFields++;
    const { field_masked, ...rest } = st;
    return rest;
  });
  return {
    schema_version: '1.0',
    session: {
      id: session.id,
      ticket: session.ticket,
      started_at: session.started_at,
      ended_at: session.ended_at,
      status: session.status,
      operator: settings.operatorLabel ? { label: settings.operatorLabel.slice(0, 120) } : null,
      agent: {
        type: 'browser_extension',
        name: AGENT_NAME,
        version: VERSION,
        browser: 'chrome',
        platform: (self.navigator && navigator.platform) || 'unknown',
      },
      allowlist: session.allowlist,
      privacy: {
        masking_policy: POLICY,
        value_capture: session.value_capture || 'masked',
        masked_fields: maskedFields,
        redactions,
      },
      step_count: steps.length,
    },
    steps,
  };
}

function safeName(s) {
  return String(s).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
}

async function exportSession(id) {
  const payload = await buildPayload(id);
  const json = JSON.stringify(payload, null, 2);
  const date = payload.session.started_at.slice(0, 19).replace(/[:T]/g, '-');
  const filename = 'gitgood-capture_' + safeName(payload.session.ticket.external_id) + '_' + date + '.json';
  const downloadId = await chrome.downloads.download({
    url: 'data:application/json;charset=utf-8,' + encodeURIComponent(json),
    filename,
    saveAs: false,
  });
  return { downloadId, filename };
}

// ---------- upload ----------

function bodyFor(payload, format) {
  if (format === 'normalized') return payload;
  // Formatul așteptat de backend/app/api/events/route.ts: { sessionId, sentAt, origin, events[] }.
  return {
    sessionId: payload.session.id,
    sentAt: new Date().toISOString(),
    origin: AGENT_NAME + '@' + VERSION,
    schema_version: payload.schema_version,
    session: payload.session,
    events: payload.steps,
  };
}

async function uploadSession(id) {
  const settings = await getSettings();
  if (!settings.endpoint) throw new Error('Nu e setat URL-ul de upload (Setări).');
  const session = await loadSession(id);
  if (session && session.status === 'active') throw new Error('Oprește sesiunea înainte de upload.');
  const payload = await buildPayload(id);
  const headers = { 'Content-Type': 'application/json' };
  if (settings.uploadFormat === 'normalized') {
    headers['Idempotency-Key'] = payload.session.id;
    headers['X-Capture-Schema'] = 'gitgood.capture-session/1.0';
  }
  if (settings.apiKey) {
    headers.Authorization = 'Bearer ' + settings.apiKey;
    headers.apikey = settings.apiKey;
  }
  let upload;
  try {
    const res = await fetch(settings.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyFor(payload, settings.uploadFormat)),
    });
    let body = null;
    try { body = await res.json(); } catch (_) { /* fără JSON */ }
    const ok = res.ok || res.status === 409;
    upload = {
      status: ok ? 'uploaded' : 'failed',
      http_status: res.status,
      at: new Date().toISOString(),
      job_id: body && (body.job_id || body.jobId) || null,
      error: ok ? null : (body && body.error) || res.statusText || 'HTTP ' + res.status,
      endpoint: settings.endpoint,
    };
  } catch (e) {
    upload = { status: 'failed', http_status: null, at: new Date().toISOString(), job_id: null, error: String(e.message || e), endpoint: settings.endpoint };
  }
  await serial(async () => {
    const s = await loadSession(id);
    if (s) {
      s.upload = upload;
      await chrome.storage.local.set({ ['session:' + id]: s });
      await saveIndexEntry(indexEntry(s));
    }
  });
  if (upload.status !== 'uploaded') throw new Error('Upload eșuat: ' + upload.error);
  return upload;
}

async function deleteSession(id) {
  await serial(async () => {
    const { activeSession } = await chrome.storage.local.get('activeSession');
    if (activeSession && activeSession.id === id) throw new Error('Oprește întâi sesiunea activă.');
    await chrome.storage.local.remove(['session:' + id, stepsKey(id)]);
    const sessions = (await getIndex()).filter((s) => s.id !== id);
    await chrome.storage.local.set({ sessions });
  });
}

// Retenție locală: sesiunile încheiate mai vechi de N zile sunt șterse din browser.
async function applyRetention() {
  const settings = await getSettings();
  const days = Number(settings.retentionDays);
  if (!days || days <= 0) return;
  const cutoff = Date.now() - days * 86400000;
  for (const s of await getIndex()) {
    if (s.status !== 'active' && s.ended_at && Date.parse(s.ended_at) < cutoff) {
      try { await deleteSession(s.id); } catch (_) { /* ignore */ }
    }
  }
}

// ---------- setări ----------

async function saveSettings(patch) {
  const current = await getSettings();
  const next = Object.assign({}, current, patch);
  next.allowlist = normalizeList(next.allowlist);
  next.extraSelectors = (next.extraSelectors || []).map((s) => String(s).trim()).filter(Boolean);
  if (!['masked', 'none'].includes(next.valueCapture)) next.valueCapture = 'masked';
  if (!['events-batch', 'normalized'].includes(next.uploadFormat)) next.uploadFormat = 'events-batch';
  await chrome.storage.local.set({ settings: next });
  await syncContentScripts();
  return next;
}

async function updateBadge() {
  const { activeSession } = await chrome.storage.local.get('activeSession');
  await chrome.action.setBadgeText({ text: activeSession ? 'REC' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#b42318' });
}

// ---------- mesaje ----------

const handlers = {
  'gg:step': (msg, sender) => recordStep(msg.step, sender),
  'gg:start': (msg) => startSession(msg.ticket),
  'gg:stop': (msg) => stopSession(msg.status),
  'gg:export': (msg) => exportSession(msg.id),
  'gg:upload': (msg) => uploadSession(msg.id),
  'gg:delete': (msg) => deleteSession(msg.id),
  'gg:payload': (msg) => buildPayload(msg.id),
  'gg:saveSettings': (msg) => saveSettings(msg.settings),
  'gg:getState': async () => {
    const { activeSession } = await chrome.storage.local.get('activeSession');
    return { settings: await getSettings(), activeSession: activeSession || null, sessions: await getIndex() };
  },
  'gg:permissionsChanged': () => syncContentScripts(),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = msg && handlers[msg.type];
  if (!handler) return false;
  // Doar paginile extensiei pot controla sesiunea; content script-urile pot doar trimite pași.
  const fromExtensionPage = sender.id === chrome.runtime.id && String(sender.url || '').startsWith(chrome.runtime.getURL(''));
  if (msg.type !== 'gg:step' && !fromExtensionPage) return false;
  Promise.resolve()
    .then(() => handler(msg, sender))
    .then((data) => sendResponse({ ok: true, data }), (e) => sendResponse({ ok: false, error: String(e.message || e) }));
  return true;
});

chrome.permissions.onAdded.addListener(() => syncContentScripts());
chrome.permissions.onRemoved.addListener(() => syncContentScripts());

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  await syncContentScripts();
  await updateBadge();
  await applyRetention();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncContentScripts();
  await updateBadge();
  await applyRetention();
});
