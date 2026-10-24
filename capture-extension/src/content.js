// Content script: e înregistrat dinamic doar pe domeniile din allowlist. Observă pașii utilizatorului,
// îi maschează aici, în pagină, și trimite service worker-ului doar versiunea mascată.
(function () {
  'use strict';
  // După reîncărcarea extensiei scriptul vechi rămâne în pagină, dar fără legătură cu extensia;
  // îl înlocuim doar pe acela, nu pe unul încă viu.
  try {
    if (window.__ggCaptureAlive && window.__ggCaptureAlive()) return;
  } catch (_) { /* scriptul vechi e invalidat */ }
  window.__ggCaptureAlive = () => !!(chrome.runtime && chrome.runtime.id);

  const { scrubText, scrubUrl, maskFieldValue } = globalThis.GGMask;
  const { hostAllowed } = globalThis.GGAllowlist;

  let settings = { allowlist: [], valueCapture: 'masked', extraSelectors: [] };
  let session = null;
  let lastUrl = null;
  let indicator = null;

  function recording() {
    return !!session && session.status === 'active' && hostAllowed(location.hostname, settings.allowlist);
  }

  // Cu captura automată, primul pas pe un domeniu permis pornește sesiunea din service worker.
  function active() {
    return recording() || (settings.autoCapture === true && hostAllowed(location.hostname, settings.allowlist));
  }

  function clip(s, n) {
    if (s == null) return null;
    const t = String(s).replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, n) : null;
  }

  function scrub(s, n, reasons) {
    const c = clip(s, n);
    if (c == null) return null;
    const r = scrubText(c);
    reasons.push(...r.reasons);
    return r.text;
  }

  const INTERACTIVE =
    'a,button,select,textarea,input,label,summary,[role=button],[role=link],[role=menuitem],[role=tab],' +
    '[role=option],[role=checkbox],[role=radio],[role=switch],[role=combobox],[contenteditable=""],[contenteditable=true],[onclick]';

  function labelFor(el) {
    const aria = el.getAttribute('aria-label');
    if (aria) return aria;
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((n) => n.innerText).join(' ');
      if (t.trim()) return t;
    }
    if (el.id) {
      try {
        const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (l && l.innerText.trim()) return l.innerText;
      } catch (_) { /* ignore */ }
    }
    const wrap = el.closest('label');
    if (wrap && wrap !== el && wrap.innerText.trim()) return wrap.innerText;
    return el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') || null;
  }

  function looksGenerated(id) {
    return /\d{3,}|[a-f0-9]{8,}|^:r|^ember|^react|^mui-/i.test(id);
  }

  function selectorFor(el) {
    if (el.id && !looksGenerated(el.id)) return '#' + CSS.escape(el.id);
    for (const attr of ['data-testid', 'data-test', 'data-qa', 'name']) {
      const v = el.getAttribute(attr);
      if (v) return el.tagName.toLowerCase() + '[' + attr + '="' + v.replace(/"/g, '\\"') + '"]';
    }
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 4 && node !== document.body) {
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      if (node.id && !looksGenerated(node.id)) { parts[0] = '#' + CSS.escape(node.id); break; }
      node = parent;
    }
    return parts.join(' > ');
  }

  function describeTarget(el, reasons) {
    const tag = el.tagName.toLowerCase();
    const inputType = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : null;
    const isField = tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    // Pentru câmpuri nu luăm textul interior (ar putea fi chiar valoarea introdusă).
    const text = isField ? null : scrub(el.innerText || el.value, 120, reasons);
    return {
      tag,
      role: el.getAttribute('role') || null,
      input_type: inputType,
      label: scrub(labelFor(el), 120, reasons),
      text,
      selector: scrub(selectorFor(el), 300, reasons),
      name: scrub(el.getAttribute('name'), 80, reasons),
    };
  }

  function appInfo(reasons) {
    const u = scrubUrl(location.href);
    reasons.push(...u.reasons);
    return { domain: location.hostname, url: u.text, title: scrub(document.title, 200, reasons) };
  }

  function quote(s) {
    return s ? '„' + s + '”' : '';
  }

  function describe(type, target, value) {
    const name = target && (target.label || target.text || target.name || target.selector);
    switch (type) {
      case 'navigation': return 'Deschide pagina';
      case 'click': return 'Click pe ' + (quote(name) || target.tag);
      case 'input': return 'Completează ' + (quote(name) || 'câmpul');
      case 'select': return 'Alege ' + (value ? quote(String(value)) + ' în ' : '') + (quote(name) || 'listă');
      case 'toggle': return (value ? 'Bifează ' : 'Debifează ') + (quote(name) || 'opțiunea');
      case 'submit': return 'Trimite formularul' + (name ? ' ' + quote(name) : '');
      case 'keypress': return 'Apasă Enter în ' + (quote(name) || 'câmp');
      default: return type;
    }
  }

  function emit(type, el, value, valueMeta) {
    if (!active()) return;
    const reasons = [];
    const target = el ? describeTarget(el, reasons) : null;
    if (valueMeta) reasons.push(...valueMeta.reasons);
    const step = {
      ts: new Date().toISOString(),
      type,
      evidence_state: 'observed',
      app: appInfo(reasons),
      target,
      value: value === undefined ? null : value,
      masked: reasons.length > 0,
      mask_reasons: Array.from(new Set(reasons)),
      field_masked: !!(valueMeta && valueMeta.whole),
    };
    step.description = describe(type, target, valueMeta && valueMeta.masked ? null : value);
    try {
      chrome.runtime.sendMessage({ type: 'gg:step', step }).catch(() => {});
    } catch (_) { /* extensia a fost reîncărcată */ }
  }

  function isOurs(el) {
    return indicator && (el === indicator || indicator.contains(el));
  }

  function maskValue(el, raw) {
    return maskFieldValue(el, raw, settings);
  }

  document.addEventListener('click', (ev) => {
    const raw = ev.target instanceof Element ? ev.target : null;
    if (!raw || isOurs(raw)) return;
    const el = raw.closest(INTERACTIVE) || raw;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    // Click-urile în câmpuri text/select sunt zgomot; valoarea se înregistrează la „change”.
    if ((tag === 'input' && !['button', 'submit', 'reset', 'image', 'checkbox', 'radio'].includes(type)) ||
        tag === 'textarea' || tag === 'select' || tag === 'option') return;
    if (tag === 'input' && (type === 'checkbox' || type === 'radio')) return; // tratate la „change”
    emit('click', el);
  }, true);

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (!(el instanceof Element) || isOurs(el)) return;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
      const m = maskValue(el, 'x');
      if (m.whole && m.reasons[0] !== 'value_capture_off') emit('toggle', el, m.value, m);
      else emit('toggle', el, !!el.checked);
      return;
    }
    if (tag === 'select') {
      const opt = el.selectedOptions && el.selectedOptions[0];
      const m = maskValue(el, opt ? opt.text : el.value);
      emit('select', el, m.value, m);
      return;
    }
    if (tag === 'input' || tag === 'textarea') {
      if (type === 'file') {
        emit('input', el, '[FILE]', { reasons: [], masked: false, whole: false });
        return;
      }
      const m = maskValue(el, el.value);
      emit('input', el, m.value, m);
    }
  }, true);

  document.addEventListener('submit', (ev) => {
    const form = ev.target;
    if (!(form instanceof HTMLFormElement)) return;
    emit('submit', form.querySelector('[type=submit],button:not([type])') || form);
  }, true);

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.isComposing) return;
    const el = ev.target;
    if (!(el instanceof Element) || el.tagName.toLowerCase() !== 'input') return;
    if (el.form) return; // submit-ul formularului e capturat separat
    emit('keypress', el, 'Enter');
  }, true);

  function checkNavigation() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    emit('navigation', null);
  }

  // SPA-urile schimbă URL-ul prin history API, fără eveniment în lumea izolată, deci verificăm periodic.
  window.addEventListener('popstate', checkNavigation);
  window.addEventListener('hashchange', checkNavigation);
  setInterval(checkNavigation, 800);

  function renderIndicator() {
    const show = recording() && settings.showIndicator !== false;
    if (!show) {
      if (indicator) { indicator.remove(); indicator = null; }
      return;
    }
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.setAttribute('data-gg-indicator', '');
      const shadow = indicator.attachShadow({ mode: 'closed' });
      shadow.innerHTML =
        '<style>:host{all:initial;position:fixed;z-index:2147483647;right:12px;bottom:12px}' +
        '.pill{font:600 12px/1.2 system-ui,sans-serif;color:#fff;background:#b42318;border-radius:999px;' +
        'padding:6px 10px;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;gap:6px;align-items:center;opacity:.92}' +
        '.dot{width:8px;height:8px;border-radius:50%;background:#fff;animation:p 1.4s infinite}' +
        '@keyframes p{50%{opacity:.3}}</style><div class="pill"><span class="dot"></span><span class="t"></span></div>';
      indicator.__label = shadow.querySelector('.t');
      document.documentElement.appendChild(indicator);
    }
    indicator.__label.textContent = 'Captură GitGood · ' + (session.ticket && session.ticket.external_id || '');
  }

  function applyState(s) {
    if (s.settings) settings = Object.assign(settings, s.settings);
    if ('activeSession' in s) session = s.activeSession || null;
    renderIndicator();
  }

  chrome.storage.local.get(['settings', 'activeSession']).then((s) => {
    applyState(s);
    checkNavigation();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const s = {};
    if (changes.settings) s.settings = changes.settings.newValue || {};
    if (changes.activeSession) s.activeSession = changes.activeSession.newValue || null;
    if (!changes.settings && !changes.activeSession) return;
    const wasActive = active();
    const prevId = session && session.id;
    applyState(s);
    const newSession = !!(session && session.id !== prevId);
    // Sesiune nouă: pagina vizibilă intră ca prim pas, ca să apară imediat în backend.
    if ((!wasActive && active()) || (newSession && document.visibilityState === 'visible')) { lastUrl = null; checkNavigation(); }
  });
})();
