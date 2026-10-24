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

## Stadiu

Interfața folosește date demonstrative și stări locale. Nu este conectată la Supabase, API-ul de ingestie sau serviciul AI. Integrarea cu backend-ul și agentul rămâne la persoanele responsabile de acele taskuri.

Nu este necesară o extensie VS Code pentru a rula proiectul. Extensiile ESLint și Tailwind CSS IntelliSense sunt opționale.

## Demo conversație Teams (fără Graph)

În ecranul /review, apasă „Importă / editează conversația”, lipește câte un mesaj pe linie (opțional în formatul 10:14 Ana: mesaj) și selectează „Analizează conversația”. Interfața afișează mesajele ca surse și simulează extragerea pașilor și a unui rezultat pentru revizuirea umană.

Acesta este un prototip local pentru prezentare: nu se conectează la Microsoft Teams, nu apelează modelul AI și nu trimite textul la backend.
