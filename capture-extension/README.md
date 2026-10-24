# GitGood Capture – extensia de browser (P1)

Extensie Chrome (Manifest V3, JavaScript simplu, fără build) care capturează pașii unui utilizator
într-o aplicație web, **legați de un tichet**, **doar pe domeniile din allowlist**, cu **mascare locală**
a datelor sensibile, și îi exportă / trimite la backend în schema normalizată.

## Rulare

1. Chrome → `chrome://extensions` → activează **Developer mode** → **Load unpacked** → alege folderul
   `capture-extension/`.
2. Fixează extensia în bară, deschide **Setări** (din popup sau click dreapta → Options):
   - **Allowlist**: adaugă domeniile (ex. `localhost`, `crm.firma.ro`, `*.atlassian.net`). Chrome cere
     permisiunea pentru fiecare; extensia nu are acces la niciun alt site.
   - **Upload**: URL-ul și formatul (vezi mai jos), opțional cheia API.
3. Pe pagina aplicației: popup → completează **ID tichet** (se ghicește automat dacă URL-ul/titlul
   conține ceva de forma `ABC-123`) → **Pornește captura**. În pagină apare indicatorul „Captură GitGood”.
4. Lucrează normal. **Oprește captura** → **Export JSON** (salvează în Descărcări) sau
   **Trimite la backend**. Toate sesiunile se văd și în Setări → Sesiuni locale (previzualizare JSON,
   export, re-trimitere, ștergere).

### Cu backend-ul din repo (`backend/`, Next.js)

```bash
cd backend && npm install && npm run dev
```

În Setări lasă URL-ul implicit `http://localhost:3000/api/events` (format `events-batch`). Opțiuni:

- **Trimitere live**: pașii pleacă la backend la ~1,5 s după ce apar, iar dashboard-ul de pe
  `http://localhost:3000` îi arată în timp real. La oprire se trimit doar pașii rămași (fără dubluri).
- **Trimite automat la oprire**: toată sesiunea pleacă o singură dată, când apeși „Oprește captura”.
- **URL dashboard** (implicit `http://localhost:3000/?sessionId={sessionId}`): butonul
  „Deschide în dashboard” din popup și din Setări deschide pagina filtrată pe sesiune.

Taburile deja deschise primesc captura automat la pornirea sesiunii; dacă tocmai ai adăugat domeniul,
reîncarcă pagina.

## Test rapid, fără backend

```bash
node tools/mock-ingest-server.mjs
```

Pornește `http://localhost:8787`: `/demo` e un formular cu email, telefon, card, CNP, parolă, IBAN;
upload la `http://localhost:8787/api/events` (sau `/ingest/capture-sessions` pentru formatul
`normalized`). Sesiunile primite se salvează în `tools/received/`, iar serverul refuză orice parolă nemascată.

Teste pentru mascare și allowlist:

```bash
node tools/test-masking.mjs
```

## Upload

| Format | Endpoint | Body |
| --- | --- | --- |
| `events-batch` (implicit) | `http://localhost:3000/api/events` – backend-ul Next.js din `backend/` | `{ sessionId, sentAt, origin, schema_version, session, events: steps[] }` |
| `normalized` | endpoint-ul final P2 (ex. Supabase Edge Function) | documentul complet `{ schema_version, session, steps }` |

Contractul complet: [`docs/ingest-api.md`](docs/ingest-api.md); schema JSON:
[`schema/capture-session.v1.schema.json`](schema/capture-session.v1.schema.json).
Cheia API se trimite ca `Authorization: Bearer …` (+ `apikey` pentru Supabase). La salvare,
extensia cere permisiune pe originea backend-ului, ca fetch-ul să nu depindă de CORS.

În formatul `events-batch`, fiecare pas are în plus `kind: "action"`, `actionType` și
`metadata.label` (descrierea pasului), câmpurile pe care le afișează dashboard-ul din `backend/`.
Backend-ul păstrează `value` pentru loturile cu `origin` = `gitgood-capture@…` (valorile sunt deja
mascate în browser și sunt re-curățate pe server); pentru alte surse îl înlocuiește în continuare cu `[REMOVED]`.

## Ce se maschează (în browser, înainte de stocare și upload)

- **Integral** (fără valoare și fără lungime): `type=password`; `autocomplete` de tip `cc-*`,
  `*-password`, `one-time-code`; câmpuri al căror nume/id/label/placeholder sugerează parolă, token,
  OTP, PIN, CVV, card, IBAN, CNP; `type=email` și `type=tel`; orice element din `[data-gg-mask]` /
  `[data-private]`; selectoarele CSS adăugate în Setări.
- **Tipare în text** (valori, etichete, texte de butoane, titluri, URL-uri): emailuri, carduri
  (validate Luhn), IBAN, CNP (validat), telefoane, JWT, `Bearer …`, chei lungi. În URL-uri se mai
  maschează parametrii cu nume sensibile (`token`, `key`, `email`, `code`, …) și user:parolă.
- Opțiunea „Nu captura deloc valorile” înlocuiește orice valoare cu `[OMITTED]`.
- Service worker-ul face o a doua trecere de mascare și verifică din nou domeniul fiecărui pas.

Nu se capturează: conținutul paginii, screenshot-uri, trafic de rețea, apăsări de taste individuale,
iframe-uri. Fiecare pas are `evidence_state: "observed"`; celelalte stări (Deducție AI / Confirmat /
Neconfirmat) le setează P3/P4.

## Structură

```
manifest.json          MV3; permisiunile de site sunt opționale (doar allowlist-ul)
src/background.js      sesiuni, stocare, export, upload, retenție, înregistrarea content script-ului
src/content.js         captura pașilor în pagină + indicator
src/masking.js         reguli de mascare (folosite și de Node în teste)
src/allowlist.js       potrivirea domeniilor
ui/                    popup și pagina de setări
tools/                 server mock, pagină demo, teste
```

Agentul Windows nu face parte din MVP.
