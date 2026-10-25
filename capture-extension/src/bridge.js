// Rulează pe dashboard (localhost). Când allowlist-ul se schimbă în interfață, pagina trimite
// window.postMessage și extensia re-citește imediat lista din backend (fără să aștepte alarma).
if (!window.__ggBridge) {
window.__ggBridge = true;
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.type !== 'gg:domains-changed') return;
  try { chrome.runtime.sendMessage({ type: 'gg:domainsChanged' }); } catch (_) { /* extensie reîncărcată */ }
});
}
