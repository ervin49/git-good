let state = null;
let missingPermissions = [];

async function refresh() {
  state = await gg('gg:getState');
  await renderAllowlist();
  missingPermissions = [];
  for (const entry of state.settings.allowlist) {
    if (!(await chrome.permissions.contains({ origins: GGAllowlist.matchPatterns(entry) }))) missingPermissions.push(entry);
  }
  $('#grant-all').hidden = !missingPermissions.length;
  renderSessions();
}

function fillForm() {
  const s = state.settings;
  $('#endpoint').value = s.endpoint || '';
  $('#format').value = s.uploadFormat;
  $('#apikey').value = s.apiKey || '';
  $('#operator').value = s.operatorLabel || '';
  $('#auto-upload').checked = !!s.autoUpload;
  $('#live-sync').checked = !!s.liveSync;
  $('#auto-capture').checked = !!s.autoCapture;
  $('#auto-idle').value = s.autoIdleMinutes;
  $('#dashboard').value = s.dashboardUrl || '';
  $('#value-capture').value = s.valueCapture;
  $('#selectors').value = (s.extraSelectors || []).join('\n');
  $('#indicator').checked = s.showIndicator !== false;
  $('#retention').value = s.retentionDays;
}

async function renderAllowlist() {
  const box = $('#allow-chips');
  box.textContent = '';
  if (!state.settings.allowlist.length) {
    box.textContent = 'Niciun domeniu – extensia nu capturează nimic.';
    return;
  }
  for (const entry of state.settings.allowlist) {
    const granted = await chrome.permissions.contains({ origins: GGAllowlist.matchPatterns(entry) });
    const chip = document.createElement('span');
    chip.className = 'chip' + (granted ? '' : ' missing');
    chip.title = granted ? 'Permisiune acordată' : 'Lipsește permisiunea – click pentru a o acorda';
    const name = document.createElement('span');
    name.textContent = entry;
    if (!granted) {
      name.style.cursor = 'pointer';
      name.addEventListener('click', async () => {
        await requestDomainPermission(entry);
        await refresh();
      });
    }
    const rm = document.createElement('button');
    rm.textContent = '×';
    rm.title = 'Elimină';
    rm.addEventListener('click', async () => {
      try {
        await gg('gg:removeDomain', { entry });
      } catch (e) {
        return showMsg($('#allow-msg'), e.message, 'err');
      }
      try { await chrome.permissions.remove({ origins: GGAllowlist.matchPatterns(entry) }); } catch (_) { /* ignore */ }
      await refresh();
    });
    chip.append(name, rm);
    box.append(chip);
  }
}

$('#allow-add').addEventListener('click', async () => {
  const m = $('#allow-msg');
  const entries = $('#allow-input').value.split(/[\s,]+/).map(GGAllowlist.normalizeEntry).filter(Boolean);
  if (!entries.length) return showMsg(m, 'Domeniu invalid.', 'err');
  const granted = await chrome.permissions.request({ origins: entries.flatMap(GGAllowlist.matchPatterns) });
  if (!granted) return showMsg(m, 'Permisiunea a fost refuzată; domeniul nu a fost adăugat.', 'err');
  try {
    await gg('gg:addDomains', { entries });
  } catch (e) {
    return showMsg(m, e.message, 'err');
  }
  $('#allow-input').value = '';
  showMsg(m, 'Salvat în baza de date: ' + entries.join(', ') + '.', 'ok');
  await refresh();
});

// Domeniile venite din baza de date n-au încă permisiune; Chrome o acordă doar după un click.
// Lista e calculată în refresh(): cererea de permisiune trebuie să fie primul apel async din click.
$('#grant-all').addEventListener('click', async () => {
  const missing = missingPermissions.slice();
  if (!missing.length) return;
  const ok = await chrome.permissions.request({ origins: missing.flatMap(GGAllowlist.matchPatterns) });
  showMsg($('#allow-msg'), ok ? 'Permisiune acordată pentru: ' + missing.join(', ') : 'Permisiunea a fost refuzată.', ok ? 'ok' : 'err');
  // Re-salvarea înregistrează content script-ul și pornește captura pe taburile deschise.
  if (ok) await gg('gg:saveSettings', { settings: {} });
  await refresh();
});

async function saveAutoCapture() {
  await gg('gg:saveSettings', { settings: { autoCapture: $('#auto-capture').checked, autoIdleMinutes: $('#auto-idle').value } });
  showMsg($('#allow-msg'), 'Salvat.', 'ok');
  await refresh();
}
$('#auto-capture').addEventListener('change', saveAutoCapture);
$('#auto-idle').addEventListener('change', saveAutoCapture);

$('#allow-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#allow-add').click();
});

$('#save-upload').addEventListener('click', async () => {
  const m = $('#upload-msg');
  showMsg(m, '');
  const endpoint = $('#endpoint').value.trim();
  if (endpoint) {
    let origin;
    try { origin = new URL(endpoint).origin; } catch (_) { return showMsg(m, 'URL invalid.', 'err'); }
    // Cu permisiune pe originea backend-ului, fetch-ul din service worker nu depinde de CORS.
    const ok = await chrome.permissions.request({ origins: [origin + '/*'] });
    if (!ok) showMsg(m, 'Fără permisiune pe ' + origin + ', upload-ul merge doar dacă backend-ul permite CORS.', 'err');
  }
  await gg('gg:saveSettings', {
    settings: {
      endpoint,
      uploadFormat: $('#format').value,
      apiKey: $('#apikey').value.trim(),
      operatorLabel: $('#operator').value.trim(),
      autoUpload: $('#auto-upload').checked,
      liveSync: $('#live-sync').checked,
      dashboardUrl: $('#dashboard').value.trim(),
    },
  });
  if (!m.classList.contains('err')) showMsg(m, 'Salvat.', 'ok');
  await refresh();
});

$('#save-privacy').addEventListener('click', async () => {
  await gg('gg:saveSettings', {
    settings: {
      valueCapture: $('#value-capture').value,
      extraSelectors: $('#selectors').value.split('\n'),
      showIndicator: $('#indicator').checked,
      retentionDays: Math.max(0, Number($('#retention').value) || 0),
    },
  });
  showMsg($('#privacy-msg'), 'Salvat.', 'ok');
  await refresh();
});

function statusText(s) {
  if (s.status === 'active') return 'în curs';
  const base = s.status === 'aborted' ? 'abandonată' : 'finalizată';
  if (!s.upload) return base + ' · netrimisă';
  return base + ' · ' + (s.upload.status === 'uploaded' ? (s.upload.mode === 'live' ? 'trimisă live' : 'trimisă') : 'upload eșuat (' + s.upload.error + ')');
}

function actionButton(label, fn, cls) {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { await fn(); } catch (e) { showMsg($('#sessions-msg'), e.message, 'err'); }
    b.disabled = false;
  });
  return b;
}

function renderSessions() {
  const body = $('#sessions');
  body.textContent = '';
  if (!state.sessions.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="hint">Nicio sesiune încă.</td>';
    body.append(tr);
    return;
  }
  for (const s of state.sessions) {
    const tr = document.createElement('tr');
    const cells = [
      s.ticket.external_id + (s.ticket.title ? ' – ' + s.ticket.title : ''),
      fmtDate(s.started_at),
      String(s.step_count),
      statusText(s),
    ];
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.append(td);
    }
    const td = document.createElement('td');
    const row = document.createElement('div');
    row.className = 'row';
    row.append(
      actionButton('JSON', async () => {
        const p = await gg('gg:payload', { id: s.id });
        $('#preview').hidden = false;
        $('#preview').textContent = JSON.stringify(p, null, 2);
      }),
      actionButton('Export', async () => {
        const r = await gg('gg:export', { id: s.id });
        showMsg($('#sessions-msg'), 'Salvat: ' + r.filename, 'ok');
      }),
    );
    if (state.settings.dashboardUrl) {
      row.append(actionButton('Dashboard', () => gg('gg:openDashboard', { id: s.id })));
    }
    if (s.status !== 'active') {
      row.append(
        actionButton('Trimite', async () => {
          await gg('gg:upload', { id: s.id });
          showMsg($('#sessions-msg'), 'Trimisă.', 'ok');
          await refresh();
        }, 'primary'),
        actionButton('Șterge', async () => {
          if (!confirm('Ștergi sesiunea ' + s.ticket.external_id + ' din browser?')) return;
          await gg('gg:delete', { id: s.id });
          await refresh();
        }),
      );
    }
    td.append(row);
    tr.append(td);
    body.append(tr);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.sessions || changes.activeSession || changes.settings)) refresh();
});

gg('gg:syncDomains')
  .catch((e) => showMsg($('#allow-msg'), 'Nu am putut citi domeniile din baza de date: ' + e.message, 'err'))
  .then(refresh)
  .then(fillForm);
