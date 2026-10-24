const msg = $('#msg');
let state = null;
let tab = null;
let timer = null;

const TICKET_RE = /\b([A-Z][A-Z0-9]{1,9}-\d{1,7})\b/;

function guessTicket(t) {
  if (!t) return;
  const src = (t.url || '') + ' ' + (t.title || '');
  const m = src.match(TICKET_RE);
  if (!m || $('#t-id').value) return;
  $('#t-id').value = m[1];
  if (t.url) $('#t-url').value = t.url;
  if (/atlassian\.net|\/browse\//.test(t.url || '')) $('#t-system').value = 'jira';
  else if (/service-now\.com/.test(t.url || '')) $('#t-system').value = 'servicenow';
  else if (/zendesk\.com/.test(t.url || '')) $('#t-system').value = 'zendesk';
  else if (/github\.com/.test(t.url || '')) $('#t-system').value = 'github';
}

function tabHost() {
  try {
    const u = new URL(tab.url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null;
  } catch (_) {
    return null;
  }
}

function renderDomain() {
  const host = tab && tabHost();
  const allowed = host && GGAllowlist.hostAllowed(host, state.settings.allowlist);
  $('#domain-dot').className = 'dot ' + (allowed ? 'ok' : 'warn');
  $('#domain-text').textContent = !host
    ? 'Pagina curentă nu poate fi capturată'
    : allowed ? host + ' e în allowlist' : host + ' nu e în allowlist – nu se capturează aici';
  $('#allow-row').hidden = !host || !!allowed;
}

function render() {
  const s = state.activeSession;
  renderDomain();
  $('#idle').hidden = !!s;
  $('#recording').hidden = !s;
  clearInterval(timer);
  if (s) {
    $('#rec-ticket').textContent = s.ticket.external_id + (s.ticket.title ? ' – ' + s.ticket.title : '');
    $('#rec-steps').textContent = s.step_count;
    $('#rec-allow').textContent = s.allowlist.join(', ');
    $('#rec-live').hidden = !(state.settings.liveSync && state.settings.uploadFormat === 'events-batch');
    const tick = () => {
      const sec = Math.floor((Date.now() - Date.parse(s.started_at)) / 1000);
      $('#rec-time').textContent = Math.floor(sec / 60) + ' min ' + (sec % 60) + ' s';
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  for (const b of document.querySelectorAll('.dash')) b.hidden = !state.settings.dashboardUrl;
  const last = state.sessions.find((x) => x.status !== 'active');
  $('#last').hidden = !last || !!s;
  if (last) {
    $('#last-ticket').textContent = last.ticket.external_id;
    $('#last-steps').textContent = last.step_count;
    const up = last.upload;
    $('#last-upload').textContent = !up
      ? 'Netrimisă încă · ' + fmtDate(last.ended_at)
      : up.status === 'uploaded' ? 'Trimisă' + (up.mode === 'live' ? ' live ' : ' ') + fmtDate(up.at) + (up.job_id ? ' · job ' + up.job_id : '')
        : 'Upload eșuat: ' + up.error;
  }
}

async function refresh() {
  state = await gg('gg:getState');
  render();
}

$('#open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

$('#allow-domain').addEventListener('click', async () => {
  const host = tabHost();
  // Cererea de permisiune trebuie să fie primul apel async din click.
  const granted = await requestDomainPermission(host);
  if (!granted) return showMsg(msg, 'Permisiunea pentru ' + host + ' a fost refuzată.', 'err');
  try {
    await gg('gg:saveSettings', { settings: { allowlist: state.settings.allowlist.concat(host) } });
    showMsg(msg, host + ' a fost adăugat. Reîncarcă pagina dacă e deja deschisă.', 'ok');
    await refresh();
  } catch (e) { showMsg(msg, e.message, 'err'); }
});

$('#start').addEventListener('click', async () => {
  try {
    await gg('gg:start', {
      ticket: {
        external_id: $('#t-id').value,
        system: $('#t-system').value,
        title: $('#t-title').value || null,
        url: $('#t-url').value || null,
      },
    });
    showMsg(msg, 'Captura a pornit.', 'ok');
    await refresh();
  } catch (e) { showMsg(msg, e.message, 'err'); }
});

async function stop(status) {
  try {
    const s = await gg('gg:stop', { status });
    const up = s && s.upload;
    showMsg(msg, up && up.status === 'uploaded' ? 'Sesiunea a fost salvată și trimisă.'
      : up ? 'Salvată local; upload eșuat: ' + up.error
        : status === 'aborted' ? 'Sesiunea a fost marcată ca abandonată.' : 'Sesiunea a fost salvată local.', up && up.status !== 'uploaded' ? 'err' : 'ok');
    await refresh();
  } catch (e) { showMsg(msg, e.message, 'err'); }
}
$('#stop').addEventListener('click', () => stop('completed'));
$('#abort').addEventListener('click', () => stop('aborted'));

function lastId() {
  const last = state.sessions.find((x) => x.status !== 'active');
  return last && last.id;
}

$('#export').addEventListener('click', async () => {
  try {
    const r = await gg('gg:export', { id: lastId() });
    showMsg(msg, 'Salvat în Descărcări: ' + r.filename, 'ok');
  } catch (e) { showMsg(msg, e.message, 'err'); }
});

$('#upload').addEventListener('click', async () => {
  $('#upload').disabled = true;
  try {
    await gg('gg:upload', { id: lastId() });
    showMsg(msg, 'Trimisă la ' + state.settings.endpoint, 'ok');
  } catch (e) { showMsg(msg, e.message, 'err'); }
  $('#upload').disabled = false;
  await refresh();
});

for (const b of document.querySelectorAll('.dash')) {
  b.addEventListener('click', async () => {
    const id = b.dataset.which === 'active' ? state.activeSession && state.activeSession.id : lastId();
    try { await gg('gg:openDashboard', { id }); } catch (e) { showMsg(msg, e.message, 'err'); }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.activeSession || changes.sessions || changes.settings)) refresh();
});

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await refresh();
  guessTicket(tab);
})();
