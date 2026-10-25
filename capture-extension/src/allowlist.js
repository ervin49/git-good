// Allowlist de domenii. O intrare „exemplu.ro” permite exemplu.ro și orice subdomeniu;
// „*.exemplu.ro” permite doar subdomeniile. Porturile sunt ignorate (localhost:5173 → localhost).
(function (root) {
  'use strict';

  function normalizeEntry(raw) {
    let s = String(raw || '').trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
    if (!/^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(s)) return null;
    return s;
  }

  function normalizeList(list) {
    const out = [];
    for (const item of list || []) {
      const n = normalizeEntry(item);
      if (n && !out.includes(n)) out.push(n);
    }
    return out;
  }

  function hostAllowed(hostname, list) {
    const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
    if (!host) return false;
    for (const entry of list || []) {
      if (entry.startsWith('*.')) {
        const base = entry.slice(2);
        if (host.endsWith('.' + base)) return true;
      } else if (host === entry || host.endsWith('.' + entry)) {
        return true;
      }
    }
    return false;
  }

  function urlAllowed(url, list) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      return hostAllowed(u.hostname, list);
    } catch (_) {
      return false;
    }
  }

  // Match patterns pentru chrome.permissions / chrome.scripting.
  function matchPatterns(entry) {
    if (entry.startsWith('*.')) return ['*://' + entry + '/*'];
    if (!entry.includes('.') || /^\d+(\.\d+){3}$/.test(entry)) return ['*://' + entry + '/*'];
    return ['*://' + entry + '/*', '*://*.' + entry + '/*'];
  }

  // Helpy itself (the upload endpoint's or the dashboard's origin) is never captured, even when its
  // host is in the allowlist (e.g. "localhost" for both Helpy and a demo app on another port).
  function appOrigins(settings) {
    const out = [];
    for (const u of [settings && settings.endpoint, settings && settings.dashboardUrl]) {
      try { if (u) out.push(new URL(String(u).replace('{sessionId}', 'x')).origin); } catch (_) { /* URL invalid */ }
    }
    return out;
  }

  function isOwnApp(url, settings) {
    try { return appOrigins(settings).includes(new URL(url).origin); } catch (_) { return false; }
  }

  const api = { normalizeEntry, normalizeList, hostAllowed, urlAllowed, matchPatterns, isOwnApp };
  root.GGAllowlist = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
