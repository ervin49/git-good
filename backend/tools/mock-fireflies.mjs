// Local stand-in for the Fireflies GraphQL API, for demos without a Fireflies account.
//   node tools/mock-fireflies.mjs        → http://localhost:8790/graphql
//   FIREFLIES_API_URL=http://localhost:8790/graphql FIREFLIES_API_KEY=demo npm run dev
import { createServer } from "node:http";

const PORT = Number(process.env.PORT) || 8790;
const day = 86_400_000;

const transcripts = [
  {
    id: "ff-demo-1",
    title: "FAC-1042 – eroare de serie la emiterea facturii",
    dateString: new Date(Date.now() - 2 * day).toISOString(),
    duration: 18.5,
    transcript_url: "https://app.fireflies.ai/view/ff-demo-1",
    participants: ["ioana@firma.ro", "mihai@firma.ro", "client@exemplu.ro"],
    sentences: [
      { index: 0, speaker_name: "Ioana", text: "Clientul nu poate emite factura, primește eroare de serie.", start_time: "3.1", end_time: "7.4" },
      { index: 1, speaker_name: "Mihai", text: "Am verificat în ERP: seria FCT nu era activă pentru anul curent.", start_time: "8.0", end_time: "13.2" },
      { index: 2, speaker_name: "Mihai", text: "Am mers în Setări, Serii documente, am activat seria și am salvat.", start_time: "13.5", end_time: "19.0" },
      { index: 3, speaker_name: "Ioana", text: "Trimit confirmarea pe ion.popescu@exemplu.ro după ce testăm.", start_time: "19.4", end_time: "23.0" },
    ],
    summary: {
      overview: "Echipa a rezolvat eroarea de serie la facturare (FAC-1042) activând seria în ERP.",
      action_items: "Mihai: documentează pașii de activare a seriei\nIoana: confirmă rezolvarea cu clientul",
      keywords: "facturare, serie, ERP",
      shorthand_bullet: "",
    },
  },
  {
    id: "ff-demo-2",
    title: "Sync operațiuni – comenzi blocate",
    dateString: new Date(Date.now() - 5 * day).toISOString(),
    duration: 32,
    transcript_url: "https://app.fireflies.ai/view/ff-demo-2",
    participants: ["dan@firma.ro", "elena@firma.ro"],
    sentences: [
      { index: 0, speaker_name: "Dan", text: "Pentru OPS-2281 comanda a rămas în procesare de ieri.", start_time: "1.0", end_time: "4.5" },
      { index: 1, speaker_name: "Elena", text: "Am repornit jobul de sincronizare din CRM și comanda a trecut.", start_time: "5.0", end_time: "9.8" },
    ],
    summary: { overview: "Comanda blocată din OPS-2281 a fost deblocată prin repornirea jobului de sincronizare.", action_items: "Elena: adaugă alertă pentru jobul de sincronizare", keywords: ["CRM", "comenzi"], shorthand_bullet: "" },
  },
  {
    id: "ff-demo-3",
    title: "1:1 personal",
    dateString: new Date(Date.now() - 1 * day).toISOString(),
    duration: 25,
    transcript_url: "https://app.fireflies.ai/view/ff-demo-3",
    participants: ["ana@firma.ro", "alex@firma.ro"],
    sentences: [{ index: 0, speaker_name: "Ana", text: "Discuție personală, fără legătură cu vreun tichet.", start_time: "0.5", end_time: "3.0" }],
    summary: { overview: "Discuție 1:1.", action_items: "", keywords: "", shorthand_bullet: "" },
  },
];

createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method !== "POST" || !req.url.startsWith("/graphql")) return send(404, { error: "not found" });
  if (!/^Bearer \S+/.test(req.headers.authorization ?? "")) return send(401, { errors: [{ message: "Unauthorized" }] });
  const { variables = {} } = JSON.parse(raw || "{}");
  const from = variables.fromDate ? Date.parse(variables.fromDate) : 0;
  const keyword = (variables.keyword ?? "").toLowerCase();
  const skip = variables.skip ?? 0;
  const limit = Math.min(variables.limit ?? 50, 50);
  const list = transcripts
    .filter((t) => Date.parse(t.dateString) >= from)
    .filter((t) => !keyword || t.title.toLowerCase().includes(keyword))
    .slice(skip, skip + limit);
  console.log(`[mock-fireflies] transcripts skip=${skip} → ${list.length}`);
  send(200, { data: { transcripts: list } });
}).listen(PORT, () => console.log(`Mock Fireflies pe http://localhost:${PORT}/graphql`));
