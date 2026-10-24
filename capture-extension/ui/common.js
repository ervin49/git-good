// Utilitare comune pentru popup și pagina de setări.
async function gg(type, extra) {
  const res = await chrome.runtime.sendMessage(Object.assign({ type }, extra || {}));
  if (!res || !res.ok) throw new Error((res && res.error) || 'Eroare necunoscută');
  return res.data;
}

function $(sel) {
  return document.querySelector(sel);
}

function showMsg(el, text, kind) {
  el.textContent = text || '';
  el.className = 'msg' + (kind ? ' ' + kind : '');
}

// Trebuie apelată direct dintr-un click (chrome.permissions.request cere gest al utilizatorului).
async function requestDomainPermission(entry) {
  return chrome.permissions.request({ origins: GGAllowlist.matchPatterns(entry) });
}

function fmtDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' });
}
