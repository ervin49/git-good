# NOD — Frontend

Interfața demonstrativă NOD, construită cu Next.js App Router, React, TypeScript și Tailwind CSS.

## Pornire locală (pentru toată echipa)

Cerință: Node.js 22.5 sau mai nou (backend-ul folosește `node:sqlite`) și npm.

1. **Cheile API** nu sunt în repo (repo-ul e public; cheile publicate sunt furate sau dezactivate automat). Fiecare își face fișierul local:
   ```bash
   cp backend/.env.example backend/.env.local
   ```
   și pune în el cel puțin `GEMINI_API_KEY` (gratuit, de la https://aistudio.google.com/apikey, cu un cont Gmail personal). Opțional: `FIREFLIES_API_KEY`. `backend/.env.local` e ignorat de git.
2. **Backend** (port 3001):
   ```bash
   cd backend && npm install && npm run dev
   ```
3. **Frontend** (port 3000), într-un alt terminal:
   ```bash
   cd front && npm install && npm run dev
   ```
   Apoi deschide [http://localhost:3000](http://localhost:3000).
4. **Extensia de captură** (opțional): `chrome://extensions` → Developer mode → Load unpacked → folderul `capture-extension`. Pași în [`capture-extension/README.md`](capture-extension/README.md).

## Ecrane incluse

- `/` — dashboard
- `/review` — revizuire și confirmare procedură
- `/procedures` — biblioteca și filtrele de proceduri
- `/search` — căutare demonstrativă
- `/settings/privacy` — surse și setări de confidențialitate
- `/meetings` — ședințe importate din Fireflies și procedurile generate din ele
- `/roadmap` — roadmap de dezvoltare pentru angajați, din slăbiciunile de la interviu

## Conectarea la backend

Frontend-ul (portul 3000) trimite toate cererile `/api/*` către backend (portul 3001) prin `rewrites` din `front/next.config.ts`. Extensia de captură poate păstra deci URL-ul implicit `http://localhost:3000/api/events`.

```bash
cd backend && GEMINI_API_KEY=... npm run dev   # http://localhost:3001 (sau OPENAI_API_KEY=...)
cd front && npm run dev                        # http://localhost:3000
```

Pentru alt backend, setează `BACKEND_URL` (ex. `BACKEND_URL=http://localhost:4000`) înainte de a porni frontend-ul.

- `/review` — secțiunea „Sesiuni capturate” citește sesiunile din `GET /api/events` și generează o ciornă cu `POST /api/ai/draft`. Acceptă `?sessionId=...`.
- `/search` — trimite întrebarea și procedurile aprobate la `POST /api/ai/search`; dacă AI-ul nu e disponibil, afișează potrivirea locală.
- `/?sessionId=...` (deschis de butonul extensiei) — afișează un link către ciorna sesiunii.

## Ședințe din Fireflies → proceduri

Pagina `/meetings` importă transcrierile ședințelor din [Fireflies.ai](https://docs.fireflies.ai) (GraphQL API) și le transformă în proceduri pe pași.

```bash
cd backend && FIREFLIES_API_KEY=... GEMINI_API_KEY=... npm run dev
```

- **Import** (`POST /api/integrations/fireflies`, `{ days, keyword?, onlyWithTicket }`): implicit se păstrează doar ședințele în care apare un ID de tichet (ex. `FAC-1042`) în titlu, rezumat sau replici. Emailurile participanților nu se salvează (doar numărul lor), iar emailurile/token-urile spuse în ședință sunt mascate înainte de stocare în SQLite.
- **Procedură din discuție** (`POST /api/meetings/:id/draft`): fiecare replică devine un pas citabil și trece prin `ai/processor.mjs`. Pașii doar povestiți în ședință ies cel mult „Deducție AI”; AI-ul nu poate marca „Confirmat”.
- `GET /api/meetings/:id` (transcriere), `GET /api/meetings/:id/draft` (proceduri generate), `DELETE /api/meetings/:id`.

Demo fără cont Fireflies: `node backend/tools/mock-fireflies.mjs`, apoi pornește backend-ul cu `FIREFLIES_API_URL=http://localhost:8790/graphql FIREFLIES_API_KEY=demo`. `OPENAI_BASE_URL` poate indica un endpoint compatibil cu Responses API (implicit `https://api.openai.com/v1`).

## Stadiu

Lista de proceduri, metricile și cazul exemplu din `/review` sunt încă date demonstrative (backend-ul nu are încă stocare pentru proceduri). AI-ul merge cu Gemini (gratuit, `GEMINI_API_KEY` din aistudio.google.com) sau OpenAI (`OPENAI_API_KEY`); dacă sunt ambele, alegi cu `AI_PROVIDER=gemini|openai`. Cheile se pun în `backend/.env.local` (ignorat de git). Fără nicio cheie, rutele AI răspund 503 și interfața afișează mesajul corespunzător.

Nu este necesară o extensie VS Code pentru a rula proiectul. Extensiile ESLint și Tailwind CSS IntelliSense sunt opționale.