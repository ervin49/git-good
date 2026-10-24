// Server local fără dependențe pentru test: primește sesiuni de la extensie și servește o pagină demo.
//   node tools/mock-ingest-server.mjs            → http://localhost:8787
//   POST /api/events            (format events-batch, ca backend/app/api/events)
//   POST /ingest/capture-sessions (format normalized, contract v1)
//   GET  /demo                  pagină de test cu formular (email, parolă, card)
// Sesiunile primite se salvează în tools/received/.
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const OUT = join(here, 'received');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, Idempotency-Key, X-Capture-Schema',
};

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, ...CORS });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function validate(doc) {
  const errors = [];
  const session = doc.session;
  const steps = doc.steps ?? doc.events;
  if (doc.events && typeof doc.sessionId !== 'string') errors.push('sessionId lipsă');
  if (!session || typeof session !== 'object') errors.push('session lipsă');
  else {
    if (!session.ticket?.external_id) errors.push('session.ticket.external_id lipsă');
    if (!session.privacy?.masking_policy) errors.push('session.privacy lipsă');
  }
  if (!Array.isArray(steps)) errors.push('steps/events trebuie să fie array');
  else steps.forEach((s, i) => {
    if (i > 0 && s.seq !== steps[i - 1].seq + 1) errors.push(`steps[${i}].seq = ${s.seq} nu e consecutiv`);
    if (s.evidence_state !== 'observed') errors.push(`steps[${i}].evidence_state`);
    if (s.target?.input_type === 'password' && s.value && !String(s.value).startsWith('[REDACTED')) {
      errors.push(`steps[${i}]: parolă nemascată!`);
    }
  });
  return errors;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method === 'GET' && (url.pathname === '/demo' || url.pathname === '/')) {
    return send(res, 200, await readFile(join(here, 'demo-page.html'), 'utf8'), 'text/html; charset=utf-8');
  }
  if (req.method === 'POST' && (url.pathname === '/api/events' || url.pathname === '/ingest/capture-sessions')) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let doc;
    try { doc = JSON.parse(raw); } catch { return send(res, 400, { error: 'invalid JSON' }); }
    const errors = validate(doc);
    if (errors.length) return send(res, 422, { error: errors.join('; ') });
    const id = doc.session.id;
    await mkdir(OUT, { recursive: true });
    await writeFile(join(OUT, `${id}.json`), JSON.stringify(doc, null, 2));
    const steps = doc.steps ?? doc.events;
    console.log(`[${new Date().toISOString()}] ${url.pathname} ${doc.session.ticket.external_id}: ${steps.length} pași, ` +
      `auth=${req.headers.authorization ? 'da' : 'nu'}, redactări=${JSON.stringify(doc.session.privacy.redactions)}`);
    return send(res, 201, { session_id: id, job_id: `job_${id.slice(0, 8)}`, stored: steps.length });
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => {
  console.log(`Mock ingest pe http://localhost:${PORT}  (demo: /demo, upload: /api/events sau /ingest/capture-sessions)`);
});
