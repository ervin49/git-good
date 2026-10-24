# NOD — Frontend

Interfața demonstrativă NOD, construită cu Next.js App Router, React, TypeScript și Tailwind CSS.

## Pornire locală

Cerință: Node.js 20.9 sau mai nou și npm. În acest calculator sunt deja instalate Node.js 24 și npm 11.

Din PowerShell, deschide folderul `frontend` și pornește aplicația:

```powershell
npm run dev
```

Apoi deschide [http://localhost:3000](http://localhost:3000).

## Ecrane incluse

- `/` — dashboard
- `/review` — revizuire și confirmare procedură
- `/procedures` — biblioteca și filtrele de proceduri
- `/search` — căutare demonstrativă
- `/settings/privacy` — surse și setări de confidențialitate

## Conectarea la backend

Frontend-ul (portul 3000) trimite toate cererile `/api/*` către backend (portul 3001) prin `rewrites` din `front/next.config.ts`. Extensia de captură poate păstra deci URL-ul implicit `http://localhost:3000/api/events`.

```bash
cd backend && OPENAI_API_KEY=... npm run dev   # http://localhost:3001
cd front && npm run dev                        # http://localhost:3000
```

Pentru alt backend, setează `BACKEND_URL` (ex. `BACKEND_URL=http://localhost:4000`) înainte de a porni frontend-ul.

- `/review` — secțiunea „Sesiuni capturate” citește sesiunile din `GET /api/events` și generează o ciornă cu `POST /api/ai/draft`. Acceptă `?sessionId=...`.
- `/search` — trimite întrebarea și procedurile aprobate la `POST /api/ai/search`; dacă AI-ul nu e disponibil, afișează potrivirea locală.
- `/?sessionId=...` (deschis de butonul extensiei) — afișează un link către ciorna sesiunii.

## Stadiu

Lista de proceduri, metricile și cazul exemplu din `/review` sunt încă date demonstrative (backend-ul nu are încă stocare pentru proceduri). Fără `OPENAI_API_KEY` pe backend, rutele AI răspund 503 și interfața afișează mesajul corespunzător.

Nu este necesară o extensie VS Code pentru a rula proiectul. Extensiile ESLint și Tailwind CSS IntelliSense sunt opționale.