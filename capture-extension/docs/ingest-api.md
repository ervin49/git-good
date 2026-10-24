# Contract API de ingestie (P1 → P2)

Extensia trimite o sesiune de captură finalizată, ca un singur document JSON, la URL-ul configurat în
setări. Până când P2 publică endpoint-ul real, contractul de mai jos e sursa de adevăr; schema JSON
completă e în [`../schema/capture-session.v1.schema.json`](../schema/capture-session.v1.schema.json).

## Request

```
POST {ENDPOINT_URL}
Content-Type: application/json
Authorization: Bearer {API_KEY}
apikey: {API_KEY}
Idempotency-Key: {session.id}
X-Capture-Schema: gitgood.capture-session/1.0
```

- `ENDPOINT_URL` – sugestie pentru Supabase: `https://<proiect>.supabase.co/functions/v1/ingest-capture`.
- `API_KEY` – cheia emisă de backend pentru agent (sau anon key + JWT). Header-ul `apikey` e
  trimis doar pentru compatibilitate cu gateway-ul Supabase; backend-ul poate folosi doar `Authorization`.
- `Idempotency-Key` = `session.id` (UUID). Re-trimiterea aceleiași sesiuni nu trebuie să creeze duplicate.

## Body (rezumat)

```jsonc
{
  "schema_version": "1.0",
  "session": {
    "id": "8b0e…",                      // UUID generat de extensie
    "ticket": {
      "external_id": "SUP-142",         // obligatoriu
      "system": "jira",                 // jira | servicenow | zendesk | github | freshdesk | other
      "title": "Resetare acces client", // opțional
      "url": "https://…/browse/SUP-142" // opțional, mascat
    },
    "started_at": "2026-10-24T14:00:00.000Z",
    "ended_at":   "2026-10-24T14:07:12.000Z",
    "status": "completed",              // completed | aborted
    "operator": { "label": "ana" },     // opțional; etichetă setată local, nu email
    "agent": { "type": "browser_extension", "name": "gitgood-capture", "version": "0.1.0",
               "browser": "chrome", "platform": "MacIntel" },
    "allowlist": ["crm.exemplu.ro", "jira.exemplu.ro"],
    "privacy": {
      "masking_policy": "gitgood-local-v1",
      "value_capture": "masked",        // masked | none
      "masked_fields": 4,               // câte câmpuri au fost mascate integral
      "redactions": { "email": 2, "password": 1, "card": 1 }
    },
    "step_count": 23
  },
  "steps": [
    {
      "id": "c2f1…",
      "seq": 1,
      "ts": "2026-10-24T14:00:03.120Z",
      "type": "navigation",            // navigation | click | input | select | toggle | submit | keypress
      "evidence_state": "observed",    // întotdeauna "observed" la captură; P3 setează celelalte stări
      "app": { "domain": "crm.exemplu.ro", "url": "https://crm.exemplu.ro/clients?q=[REDACTED:email]",
               "title": "Clienți" },
      "target": {                      // null pentru navigation
        "tag": "input", "role": "textbox", "input_type": "email",
        "label": "Email client", "text": null,
        "selector": "#client-email", "name": "email"
      },
      "value": "[REDACTED:email]",     // deja mascat local; null dacă nu are sens
      "masked": true,
      "mask_reasons": ["email"],
      "description": "Completează „Email client”"  // descriere generată local, utilă pentru P3/P4
    }
  ]
}
```

Garanții oferite de extensie:

1. Datele sensibile sunt mascate **în browser**, înainte de stocarea locală și înainte de upload.
   Parolele, câmpurile de card/CVV/OTP/token și câmpurile marcate `data-gg-mask` nu ajung niciodată
   în JSON, nici măcar ca lungime.
2. Pașii vin doar din domenii din allowlist (verificat atât în content script, cât și în service worker).
3. `seq` e strict crescător în sesiune; `ts` e ISO-8601 UTC.

## Response așteptat

| Cod | Semnificație | Ce face extensia |
| --- | --- | --- |
| `201` / `200` | Acceptat. Body opțional: `{ "session_id": "…", "job_id": "…" }` | marchează sesiunea „trimisă” și salvează `job_id` |
| `409` | Sesiunea există deja (idempotency) | o tratează ca trimisă |
| `400` / `422` | Payload invalid. Body: `{ "error": "…" }` | afișează eroarea, păstrează sesiunea local |
| `401` / `403` | Cheie invalidă | afișează eroarea |
| `5xx` / rețea | Eroare temporară | păstrează sesiunea; utilizatorul poate reîncerca |

Backend-ul trebuie să răspundă la preflight `OPTIONS` cu CORS permisiv pentru
`Authorization, apikey, content-type, idempotency-key, x-capture-schema` (Supabase Edge Functions
o fac dacă returnezi header-ele în funcție).

## Mapare sugerată pe Postgres (pentru P2)

- `capture_sessions` ← `session.*` (cheie `id`, FK spre `tickets` prin `ticket.external_id` + `ticket.system`)
- `capture_steps` ← `steps[]` (FK `session_id`, unic pe `(session_id, seq)`)
- `privacy` și `agent` pot fi coloane `jsonb` pentru audit.
- După insert, P2 pornește jobul de procesare AI (P3) și răspunde cu `job_id`.

Pentru test local există un server mock fără dependențe: `node tools/mock-ingest-server.mjs`
(vezi README).
