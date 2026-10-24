export type CaseItem = {
  id: string;
  title: string;
  area: string;
  source: string;
  updated: string;
  evidence: string;
  evidenceLevel: "puternică" | "medie" | "slabă";
  status: "De revizuit" | "În lucru" | "Aprobată";
};

export const cases: CaseItem[] = [
  { id: "FAC-1042", title: "Factura nu se emite — eroare de serie", area: "Financiar", source: "ERP · Facturare", updated: "acum 18 min", evidence: "2 surse", evidenceLevel: "puternică", status: "De revizuit" },
  { id: "OPS-2281", title: "Comandă rămasă în procesare", area: "Operațiuni", source: "CRM · Comenzi", updated: "acum 46 min", evidence: "3 surse", evidenceLevel: "puternică", status: "De revizuit" },
  { id: "IT-0874", title: "Acces expirat la mediul de test", area: "IT", source: "Teams · #support-ops", updated: "acum 2 ore", evidence: "1 sursă", evidenceLevel: "medie", status: "În lucru" },
  { id: "LOG-0612", title: "Etichetă de retur generată greșit", area: "Logistică", source: "ERP · Retururi", updated: "ieri, 16:42", evidence: "2 surse", evidenceLevel: "medie", status: "De revizuit" },
];

export const procedures = [
  { id: "PR-018", title: "Rezolvarea erorii de emitere a facturii", category: "Financiar", context: "ERP · Facturare", status: "Aprobată", updated: "Astăzi", sources: 3, confidence: 96 },
  { id: "PR-017", title: "Deblocarea unei comenzi în procesare", category: "Operațiuni", context: "CRM · Comenzi", status: "În revizuire", updated: "Astăzi", sources: 4, confidence: 88 },
  { id: "PR-016", title: "Reînnoirea accesului la mediul de test", category: "IT", context: "Azure · Acces", status: "Aprobată", updated: "Ieri", sources: 2, confidence: 92 },
  { id: "PR-015", title: "Generarea etichetei de retur", category: "Logistică", context: "ERP · Retururi", status: "Aprobată", updated: "21 oct. 2026", sources: 3, confidence: 94 },
  { id: "PR-014", title: "Verificarea plății înainte de expediere", category: "Financiar", context: "ERP · Plăți", status: "În revizuire", updated: "20 oct. 2026", sources: 2, confidence: 79 },
];