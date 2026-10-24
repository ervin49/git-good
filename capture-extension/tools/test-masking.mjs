// Teste rapide pentru mascare și allowlist: node tools/test-masking.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../src/masking.js');
const A = require('../src/allowlist.js');

// Element minimal, suficient pentru sensitiveFieldReason / maskFieldValue.
function el(attrs = {}) {
  return {
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    hasAttribute: (k) => k in attrs,
    matches: () => false,
    closest: () => null,
  };
}

let n = 0;
function t(name, fn) { fn(); n++; console.log('✓', name); }

t('email în text', () => {
  const r = M.scrubText('Scrie la ion.popescu@exemplu.ro azi');
  assert.equal(r.text, 'Scrie la [REDACTED:email] azi');
  assert.deepEqual(r.reasons, ['email']);
});
t('card valid Luhn mascat, număr oarecare păstrat', () => {
  assert.equal(M.scrubText('card 4111 1111 1111 1111').text, 'card [REDACTED:card]');
  assert.equal(M.scrubText('comanda 1234567890123').text, 'comanda 1234567890123');
});
t('CNP valid', () => {
  assert.equal(M.cnpOk('1800101221144'), true);
  assert.equal(M.scrubText('CNP 1800101221144').text, 'CNP [REDACTED:cnp]');
});
t('IBAN, telefon, JWT, Bearer', () => {
  assert.equal(M.scrubText('RO49AAAA1B31007593840000').text, '[REDACTED:iban]');
  assert.equal(M.scrubText('tel 0722 123 456').text, 'tel [REDACTED:phone]');
  assert.equal(M.scrubText('tel +40 722 123 456').text, 'tel [REDACTED:phone]');
  assert.match(M.scrubText('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop').text, /^\[REDACTED:token\]$/);
  assert.equal(M.scrubText('Authorization: Bearer abcdefghijklmnop123').text, 'Authorization: [REDACTED:token]');
});
t('text normal neatins', () => {
  const s = 'Click pe Salvează în pagina Clienți (pas 3 din 12)';
  assert.equal(M.scrubText(s).text, s);
});
t('câmp parolă: mascat integral, fără lungime', () => {
  const r = M.maskFieldValue(el({ type: 'password' }), 'SuperSecret!1');
  assert.deepEqual(r, { value: '[REDACTED:password]', masked: true, whole: true, reasons: ['password'] });
});
t('câmpuri sensibile după autocomplete / nume / atribut', () => {
  assert.equal(M.maskFieldValue(el({ autocomplete: 'cc-number' }), '4111').value, '[REDACTED:card]');
  assert.equal(M.maskFieldValue(el({ name: 'otp_code' }), '123456').value, '[REDACTED:sensitive_field]');
  assert.equal(M.maskFieldValue(el({ 'data-gg-mask': '' }), 'orice').value, '[REDACTED:marked_private]');
  assert.equal(M.maskFieldValue(el({ type: 'email' }), 'a@b.ro').value, '[REDACTED:email]');
  assert.equal(M.maskFieldValue(el({ type: 'tel' }), '0722').value, '[REDACTED:phone]');
});
t('câmp normal: păstrat, cu tipare mascate', () => {
  assert.equal(M.maskFieldValue(el({ name: 'clientName' }), 'Ion Popescu').value, 'Ion Popescu');
  assert.equal(M.maskFieldValue(el({ name: 'notes' }), 'a scris de pe x@y.com').value, 'a scris de pe [REDACTED:email]');
  assert.equal(M.maskFieldValue(el({ name: 'notes' }), 'orice', { valueCapture: 'none' }).value, '[OMITTED]');
});
t('URL: parametri sensibili și emailuri', () => {
  const r = M.scrubUrl('https://user:pw@crm.ro/clients/ion@x.ro?token=abc&q=hello&mail=a@b.ro#t');
  assert.equal(r.text, 'https://crm.ro/clients/[REDACTED:email]?token=REDACTED&q=hello&mail=REDACTED#t');
});
t('allowlist', () => {
  const list = A.normalizeList(['https://CRM.firma.ro/path', '*.atlassian.net', 'localhost:5173', 'bad domain']);
  assert.deepEqual(list, ['crm.firma.ro', '*.atlassian.net', 'localhost']);
  assert.equal(A.hostAllowed('crm.firma.ro', list), true);
  assert.equal(A.hostAllowed('eu.crm.firma.ro', list), true);
  assert.equal(A.hostAllowed('firma.ro', list), false);
  assert.equal(A.hostAllowed('evilcrm.firma.ro', list), false);
  assert.equal(A.hostAllowed('acme.atlassian.net', list), true);
  assert.equal(A.hostAllowed('atlassian.net', list), false);
  assert.equal(A.urlAllowed('http://localhost:8787/demo', list), true);
  assert.equal(A.urlAllowed('chrome://extensions', list), false);
  assert.deepEqual(A.matchPatterns('localhost'), ['*://localhost/*']);
  assert.deepEqual(A.matchPatterns('crm.firma.ro'), ['*://crm.firma.ro/*', '*://*.crm.firma.ro/*']);
});

console.log(`\n${n} teste trecute`);
