// Mascare locală a datelor sensibile. Rulează în content script (înainte ca datele să părăsească pagina)
// și în service worker (a doua trecere, defensivă). Fără dependențe; se poate testa și cu Node.
(function (root) {
  'use strict';

  const POLICY = 'gitgood-local-v1';

  const SENSITIVE_NAME_RE =
    /pass(word|wd|phrase)?|pwd|parol|secret|token|api[-_]?key|otp|one[-_]?time|2fa|mfa|pin\b|cvv|cvc|csc|card|iban|account[-_]?(no|number)|ssn|cnp|security[-_]?code|auth/i;

  const SENSITIVE_AUTOCOMPLETE = new Set([
    'current-password', 'new-password', 'one-time-code',
    'cc-number', 'cc-csc', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-name', 'cc-type',
  ]);

  const SENSITIVE_QUERY_KEY_RE =
    /pass|pwd|secret|token|key|auth|session|sid|code|otp|sig|signature|email|mail|phone|tel|card|iban|cnp|ssn/i;

  function luhnOk(digits) {
    let sum = 0;
    let dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  function cnpOk(digits) {
    if (!/^[1-9]\d{12}$/.test(digits)) return false;
    const key = '279146358279';
    let s = 0;
    for (let i = 0; i < 12; i++) s += (digits.charCodeAt(i) - 48) * (key.charCodeAt(i) - 48);
    let c = s % 11;
    if (c === 10) c = 1;
    return c === digits.charCodeAt(12) - 48;
  }

  // Ordinea contează: tokenurile și emailurile înaintea numerelor, cardul înaintea telefonului.
  const TEXT_RULES = [
    { reason: 'token', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
    { reason: 'token', re: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi },
    { reason: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
    { reason: 'iban', re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g },
    {
      reason: 'card',
      re: /\b\d(?:[ -]?\d){12,18}\b/g,
      test: (m) => { const d = m.replace(/\D/g, ''); return d.length >= 13 && d.length <= 19 && luhnOk(d); },
    },
    { reason: 'cnp', re: /\b[1-9]\d{12}\b/g, test: (m) => cnpOk(m) },
    { reason: 'phone', re: /(?:\+|\b00)\d{1,3}[ .-]?\(?\d{2,4}\)?(?:[ .-]?\d{2,4}){2,4}\b/g },
    { reason: 'phone', re: /\b0[237]\d{2}[ .-]?\d{3}[ .-]?\d{3}\b/g },
    { reason: 'secret', re: /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g },
  ];

  function redactToken(reason) {
    return '[REDACTED:' + reason + ']';
  }

  // Înlocuiește tiparele sensibile dintr-un text liber. Returnează { text, reasons }.
  function scrubText(input) {
    if (input == null) return { text: input, reasons: [] };
    let text = String(input);
    const reasons = [];
    for (const rule of TEXT_RULES) {
      text = text.replace(rule.re, (m) => {
        if (rule.test && !rule.test(m)) return m;
        reasons.push(rule.reason);
        return redactToken(rule.reason);
      });
    }
    return { text, reasons };
  }

  function matchesAny(el, selectors) {
    if (!selectors || !selectors.length || typeof el.matches !== 'function') return false;
    for (const sel of selectors) {
      try { if (el.matches(sel) || (el.closest && el.closest(sel))) return true; } catch (_) { /* selector invalid */ }
    }
    return false;
  }

  // Decide dacă un câmp trebuie mascat integral (fără să-i păstrăm valoarea sau lungimea).
  // Returnează motivul sau null.
  function sensitiveFieldReason(el, extraSelectors) {
    if (!el || !el.getAttribute) return null;
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'password') return 'password';
    if (el.hasAttribute('data-gg-mask') || el.hasAttribute('data-private') ||
        (el.closest && el.closest('[data-gg-mask],[data-private]'))) return 'marked_private';
    if (matchesAny(el, extraSelectors)) return 'custom_rule';

    const ac = (el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/);
    for (const token of ac) {
      if (SENSITIVE_AUTOCOMPLETE.has(token)) return token.startsWith('cc-') ? 'card' : token === 'one-time-code' ? 'otp' : 'password';
    }
    const hints = [
      el.getAttribute('name'), el.getAttribute('id'), el.getAttribute('aria-label'),
      el.getAttribute('placeholder'), el.getAttribute('data-testid'),
    ].filter(Boolean).join(' ');
    if (SENSITIVE_NAME_RE.test(hints)) return 'sensitive_field';
    return null;
  }

  // Masca valoarea unui câmp de formular. Returnează { value, masked, whole, reasons };
  // whole = valoarea a fost înlocuită complet (nu doar tipare din ea).
  function maskFieldValue(el, rawValue, opts) {
    const options = opts || {};
    if (rawValue == null || rawValue === '') return { value: rawValue == null ? null : '', masked: false, whole: false, reasons: [] };
    const whole = sensitiveFieldReason(el, options.extraSelectors);
    if (whole) return { value: redactToken(whole), masked: true, whole: true, reasons: [whole] };
    const type = el && el.getAttribute ? (el.getAttribute('type') || '').toLowerCase() : '';
    if (type === 'email') return { value: redactToken('email'), masked: true, whole: true, reasons: ['email'] };
    if (type === 'tel') return { value: redactToken('phone'), masked: true, whole: true, reasons: ['phone'] };
    if (options.valueCapture === 'none') return { value: '[OMITTED]', masked: true, whole: true, reasons: ['value_capture_off'] };
    const s = scrubText(String(rawValue).slice(0, 500));
    return { value: s.text, masked: s.reasons.length > 0, whole: false, reasons: s.reasons };
  }

  // Masca un URL: valorile parametrilor sensibili + tipare în path/query/hash.
  function scrubUrl(url) {
    const reasons = [];
    let u;
    try { u = new URL(url); } catch (_) { return scrubText(url); }
    u.username = '';
    u.password = '';
    const params = [];
    for (const [k, v] of u.searchParams.entries()) {
      if (SENSITIVE_QUERY_KEY_RE.test(k) && v) {
        reasons.push('query_param');
        params.push([k, 'REDACTED']);
      } else {
        const s = scrubText(v);
        reasons.push(...s.reasons);
        params.push([k, s.text]);
      }
    }
    const search = params.length
      ? '?' + params.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v).replace(/%5B/g, '[').replace(/%5D/g, ']').replace(/%3A/g, ':')).join('&')
      : '';
    const path = scrubText(decodeSafe(u.pathname));
    const hash = scrubText(decodeSafe(u.hash));
    reasons.push(...path.reasons, ...hash.reasons);
    return { text: u.origin + path.text + search + hash.text, reasons };
  }

  function decodeSafe(s) {
    try { return decodeURIComponent(s); } catch (_) { return s; }
  }

  const api = { POLICY, scrubText, scrubUrl, maskFieldValue, sensitiveFieldReason, luhnOk, cnpOk };
  root.GGMask = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
