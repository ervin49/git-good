const STATUS = ["Observat", "Deducție AI", "Confirmat", "Neconfirmat"];

const evidenceSourceSchema = {
  type: "object", additionalProperties: false,
  properties: {
    source_type: { type: "string", enum: ["capture_step", "ticket", "teams_message"] },
    source_id: { type: "string" },
    seq: { type: ["integer", "null"] }
  },
  required: ["source_type", "source_id", "seq"]
};
const claimSchema = {
  type: "object", additionalProperties: false,
  properties: {
    text: { type: "string" }, status: { type: "string", enum: STATUS },
    evidence_seq: { type: "array", items: { type: "integer" } },
    evidence_sources: { type: "array", items: evidenceSourceSchema }, reason: { type: "string" }
  },
  required: ["text", "status", "evidence_seq", "evidence_sources", "reason"]
};
const uncertaintySchema = {
  type: "object", additionalProperties: false,
  properties: {
    question: { type: "string" }, reason: { type: "string" },
    evidence_seq: { type: "array", items: { type: "integer" } },
    evidence_sources: { type: "array", items: evidenceSourceSchema }
  },
  required: ["question", "reason", "evidence_seq", "evidence_sources"]
};

export const PROCEDURE_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    session_summary: { type: "string" },
    ticket_link: {
      type: "object", additionalProperties: false,
      properties: {
        ticket_id: { type: ["string", "null"] },
        match_status: { type: "string", enum: ["matched", "candidate", "unmatched"] },
        basis: { type: "string" }, evidence_seq: { type: "array", items: { type: "integer" } }, evidence_sources: { type: "array", items: evidenceSourceSchema }
      }, required: ["ticket_id", "match_status", "basis", "evidence_seq", "evidence_sources"]
    },
    title: { type: "string" },
    applicability: { type: "array", items: claimSchema },
    prerequisites: { type: "array", items: claimSchema },
    steps: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          order: { type: "integer" }, instruction: { type: "string" },
          status: { type: "string", enum: STATUS },
          evidence_seq: { type: "array", items: { type: "integer" } }, evidence_sources: { type: "array", items: evidenceSourceSchema }, reason: { type: "string" }
        }, required: ["order", "instruction", "status", "evidence_seq", "evidence_sources", "reason"]
      }
    },
    conditions: { type: "array", items: claimSchema },
    exceptions: { type: "array", items: claimSchema },
    uncertainties: { type: "array", items: uncertaintySchema },
    outcome: { anyOf: [claimSchema, { type: "null" }] },
    sufficient_evidence: { type: "boolean" },
    missing_information: { type: "array", items: { type: "string" } }
  },
  required: ["session_summary", "ticket_link", "title", "applicability", "prerequisites", "steps", "conditions", "exceptions", "uncertainties", "outcome", "sufficient_evidence", "missing_information"]
};

const SEARCH_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          procedure_id: { type: "string" }, relevance: { type: "string", enum: ["high", "medium", "low"] }, reason: { type: "string" }
        }, required: ["procedure_id", "relevance", "reason"]
      }
    },
    needs_clarification: { type: "boolean" }, clarification_question: { type: ["string", "null"] }
  }, required: ["matches", "needs_clarification", "clarification_question"]
};

const SYSTEM_INSTRUCTIONS = `Ești motorul AI pentru NOD, care transformă sesiuni de lucru în ciorne de proceduri verificabile.
- Folosește numai datele primite. Nu inventa pași, condiții, excepții, rezultate sau context.
- Fiecare pas/afirmație citează event seq-urile și, când folosește contextul tichetului, evidence_sources cu source_type=ticket și source_id=ID-ul tichetului. Nu inventa referințe.
- Observat = acțiune/text vizibil în evenimente; Deducție AI = interpretare; Neconfirmat = dovadă lipsă sau ambiguă.
- Nu marca niciodată Confirmat. Numai un om sau un flux separat poate confirma o procedură.
- Un click, o schimbare de câmp sau un mesaj de salvare nu demonstrează singure rezolvarea problemei.
- Console/network sunt dovezi tehnice, nu pași de procedură.
- Dacă sesiunea este doar navigare/căutare generică ori nu arată un proces de business, întoarce steps=[], sufficient_evidence=false și explică lipsurile.
- Corelarea cu tichetul este matched numai când există un ID explicit care leagă sesiunea de tichet. Altfel folosește candidate/unmatched.
- Nu repeta date sensibile și nu transforma textul introdus într-un câmp de căutare în instrucțiune.
- Dacă statusul sesiunii este active sau aborted, trateaz-o ca incompletă și setează sufficient_evidence=false.
Răspunde exclusiv în JSON-ul cerut, în limba română.`;

// Extra rules when the input is a meeting transcript (session.source = "meeting"): every event is one
// spoken line, not an observed UI action.
const MEETING_INSTRUCTIONS = `
Sursa este transcrierea unei ședințe sau o conversație de chat (de ex. Teams): fiecare eveniment (actionType=utterance) este o replică sau un mesaj, cu autorul în label.
- Extrage procedura pe pași din ce descriu participanții că au făcut sau trebuie făcut; ignoră discuțiile care nu țin de proces.
- Un pas doar povestit în ședință nu este o acțiune observată: marchează-l Deducție AI dacă e descris clar, altfel Neconfirmat. Nu folosi Observat.
- Citează în evidence_seq replicile din care reiese fiecare pas. Nu include nume de persoane în instrucțiuni.`;

function redactText(value) {
  return String(value ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\b\d{13}\b/g, "[ID_REDACTAT]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi, "[IBAN_REDACTAT]")
    .replace(/\b(?:\+?40|0)[\d\s().-]{8,}\b/g, "[TELEFON_REDACTAT]")
    .slice(0, 1000);
}
function safeRoute(value) {
  try {
    const url = new URL(value);
    const path = url.pathname.split("/").map((part) => (/^[0-9]+$/.test(part) || /^[0-9a-f-]{20,}$/i.test(part) ? ":id" : part)).join("/");
    return `${url.origin}${path}`.slice(0, 300);
  } catch { return "[URL_INVALIDĂ]"; }
}
function safePath(value) {
  return String(value ?? "").split("/").map((part) => (/^[0-9]+$/.test(part) || /^[0-9a-f-]{20,}$/i.test(part) ? ":id" : part)).join("/").slice(0, 300);
}
function genericTarget(target) {
  if (typeof target !== "string") return "";
  const lower = target.toLowerCase();
  for (const tag of ["button", "input", "textarea", "select", "a", "form", "window", "document"]) {
    if (lower === tag || lower.endsWith(`>${tag}`) || lower.includes(`${tag}.`)) return tag;
  }
  return "element UI";
}
function sanitizeAction(item) {
  const event = item.event ?? item;
  const metadata = event.metadata ?? {};
  const app = event.app ?? {};
  const safeMetadata = {};
  for (const key of ["label", "inputType", "mode", "domain", "target_label"]) {
    if (typeof metadata[key] === "string") safeMetadata[key] = redactText(metadata[key]);
  }
  if (typeof metadata.path === "string") safeMetadata.path = safePath(metadata.path);
  if (typeof metadata.url === "string") safeMetadata.url = safeRoute(metadata.url);
  if (typeof metadata.title === "string") safeMetadata.title = redactText(metadata.title);
  if (typeof metadata.ticket === "string") safeMetadata.ticket_id = metadata.ticket.slice(0, 120);
  if (typeof metadata.ticket_id === "string") safeMetadata.ticket_id = metadata.ticket_id.slice(0, 120);
  if (typeof event.description === "string" && !safeMetadata.label) safeMetadata.label = redactText(event.description);
  if (typeof app.domain === "string") safeMetadata.domain = redactText(app.domain);
  if (typeof app.url === "string") safeMetadata.url = safeRoute(app.url);
  if (typeof app.title === "string") safeMetadata.title = redactText(app.title);
  const target = event.target;
  if (target && typeof target === "object" && typeof target.label === "string") safeMetadata.target_label = redactText(target.label);
  const maskReasons = Array.isArray(event.mask_reasons) ? event.mask_reasons.map((reason) => redactText(reason).slice(0, 60)) : [];
  const valueMasked = event.masked === true || event.field_masked === true || metadata.value_masked === true || maskReasons.length > 0;
  if (!valueMasked && (typeof event.value === "string" || typeof event.value === "boolean") && event.value !== "[OMITTED]") {
    safeMetadata.field_value = typeof event.value === "string" ? redactText(event.value).slice(0, 300) : event.value;
  }
  if (maskReasons.length) safeMetadata.mask_reasons = maskReasons;
  return {
    seq: Number.isInteger(item.seq) ? item.seq : null,
    source_id: typeof event.id === "string" ? event.id : (typeof item.id === "string" ? item.id : null),
    offsetMs: Number.isFinite(item.offsetMs) ? item.offsetMs : null,
    initiatedBySeq: Number.isInteger(item.initiatedBySeq) ? item.initiatedBySeq : null,
    event: {
      kind: "action",
      actionType: String(event.actionType ?? event.type ?? "unknown").slice(0, 40),
      target: genericTarget(typeof target === "string" ? target : target?.tag),
      metadata: safeMetadata
    }
  };
}
function sanitizeTechnicalEvent(item) {
  const event = item.event ?? item;
  if (item.kind === "console" || event.kind === "console") {
    if (event.level !== "error") return null;
    return { seq: item.seq, offsetMs: item.offsetMs ?? null, initiatedBySeq: item.initiatedBySeq ?? null, event: { kind: "console", level: "error", message: redactText(event.message) } };
  }
  if (item.kind === "network" || event.kind === "network") {
    const status = Number(event.status);
    if (!(status === 0 || status >= 400)) return null;
    return {
      seq: item.seq, offsetMs: item.offsetMs ?? null, initiatedBySeq: item.initiatedBySeq ?? null,
      event: { kind: "network", method: String(event.method ?? "").slice(0, 10), host_and_route: safeRoute(event.url ?? ""), status: Number.isFinite(status) ? status : null, duration_ms: Number.isFinite(event.duration) ? event.duration : null }
    };
  }
  return null;
}

export function prepareCapture(input) {
  if (!input || typeof input !== "object") throw new TypeError("Intrarea trebuie să fie un obiect JSON.");
  const sessionInput = Array.isArray(input) ? {} : (input.session ?? {});
  const nestedTicket = sessionInput.ticket ?? {};
  const normalizedSteps = !Array.isArray(input) && Array.isArray(input.steps) ? input.steps : null;
  const rawEvents = normalizedSteps ?? (Array.isArray(input) ? input : input.events);
  if (!Array.isArray(rawEvents)) throw new TypeError("Lipsesc steps sau events din captura primită.");
  const captureStart = Date.parse(sessionInput.started_at ?? "");
  const firstEntry = rawEvents.find((item) => item && typeof item === "object") ?? {};
  const firstTimestamp = (item) => {
    const event = item?.event && typeof item.event === "object" ? item.event : item;
    if (typeof event?.timestamp === "number") return event.timestamp;
    return Date.parse(event?.ts ?? item?.receivedAt ?? "");
  };
  const baseTimestamp = Number.isFinite(captureStart) ? captureStart : (rawEvents.map(firstTimestamp).find(Number.isFinite) ?? Date.now());
  const valueCaptureOff = sessionInput.privacy?.value_capture === "none";
  const events = rawEvents.map((item, index) => {
    if (!normalizedSteps && Number.isInteger(item?.seq)) return item;
    const event = item?.event && typeof item.event === "object" ? item.event : item;
    const timestamp = firstTimestamp(item);
    if (normalizedSteps) {
      const masked = valueCaptureOff || event.masked === true || event.value === "[OMITTED]";
      const target = event.target && typeof event.target === "object" ? event.target : null;
      return {
        seq: Number.isInteger(event.seq) ? event.seq : index + 1,
        offsetMs: Number.isFinite(timestamp) ? Math.max(0, timestamp - baseTimestamp) : null,
        initiatedBySeq: null,
        event: {
          kind: "action",
          id: event.id,
          actionType: event.type,
          target: target?.tag ?? "",
          description: event.description,
          app: event.app,
          metadata: {
            label: event.description,
            inputType: target?.input_type,
            target_label: target?.label,
            field_value: !masked ? event.value : undefined,
            value_masked: masked,
            domain: event.app?.domain,
            url: event.app?.url,
            title: event.app?.title,
            ticket: nestedTicket.external_id
          },
          value: !masked ? event.value : null,
          masked,
          mask_reasons: event.mask_reasons ?? []
        }
      };
    }
    return {
      seq: Number.isInteger(item?.seq) ? item.seq : index + 1,
      offsetMs: Number.isFinite(item?.offsetMs) ? item.offsetMs : (Number.isFinite(timestamp) ? Math.max(0, timestamp - baseTimestamp) : null),
      initiatedBySeq: Number.isInteger(item?.initiatedBySeq) ? item.initiatedBySeq : null,
      event
    };
  });

  const safeEvents = events.flatMap((item) => {
    const kind = item?.kind ?? item?.event?.kind;
    if (kind === "action") return [sanitizeAction(item)];
    const technical = sanitizeTechnicalEvent(item);
    return technical ? [technical] : [];
  }).filter((event) => Number.isInteger(event.seq));

  const eventTicketIds = new Set(events.map((item) => {
    const event = item?.event && typeof item.event === "object" ? item.event : item;
    const ticketId = event?.metadata?.ticket ?? event?.metadata?.ticket_id;
    return typeof ticketId === "string" && ticketId.trim() ? ticketId.trim() : null;
  }).filter(Boolean));
  const eventTicketId = eventTicketIds.size === 1 ? [...eventTicketIds][0] : null;
  const metadata = Array.isArray(input) ? {} : (input.metadata ?? {});
  const ticketInput = Array.isArray(input) ? null : (input.ticket ?? (nestedTicket.external_id ? nestedTicket : null));
  const ticketId = (typeof sessionInput.ticket_id === "string" ? sessionInput.ticket_id : null)
    ?? (typeof nestedTicket.external_id === "string" ? nestedTicket.external_id : null)
    ?? (typeof input.sessionTicketId === "string" ? input.sessionTicketId : null)
    ?? (typeof firstEntry.ticketId === "string" ? firstEntry.ticketId : null)
    ?? eventTicketId;
  const storedSessionId = typeof firstEntry.sessionId === "string" ? firstEntry.sessionId : "";
  const storedOrigin = typeof firstEntry.origin === "string" ? firstEntry.origin : "";
  const ticket = ticketInput || ticketId ? {
    ticket_id: typeof ticketInput?.ticket_id === "string" ? ticketInput.ticket_id : (typeof ticketInput?.external_id === "string" ? ticketInput.external_id : ticketId),
    title: redactText(ticketInput?.title ?? ""),
    description: redactText(ticketInput?.description ?? ticketInput?.title ?? ""),
    system: typeof ticketInput?.system === "string" ? ticketInput.system : "",
    url: typeof ticketInput?.url === "string" ? safeRoute(ticketInput.url) : ""
  } : null;
  return {
    session: {
      session_id: String(sessionInput.id ?? sessionInput.session_id ?? input.session_id ?? storedSessionId).slice(0, 120),
      ticket_id: ticketId,
      application: redactText(sessionInput.application ?? metadata.title ?? storedOrigin),
      started_at: typeof sessionInput.started_at === "string" ? sessionInput.started_at : (typeof metadata.timestamp === "string" ? metadata.timestamp : null),
      status: typeof sessionInput.status === "string" ? sessionInput.status : null,
      source: sessionInput.source === "meeting" ? "meeting" : "capture"
    },
    ticket,
    events: safeEvents
  };
}
function fallbackDraft(capture, reason) {
  const sessionTicketId = capture.session.ticket_id;
  const ticketId = capture.ticket?.ticket_id ?? null;
  const matched = !!sessionTicketId && !!ticketId && sessionTicketId === ticketId;
  const ticketEvidence = ticketId ? [{ source_type: "ticket", source_id: ticketId, seq: null }] : [];
  return {
    session_summary: "Nu există suficiente evenimente relevante pentru a descrie un proces de lucru.",
    ticket_link: {
      ticket_id: ticketId,
      match_status: matched ? "matched" : (ticketId ? "candidate" : "unmatched"),
      basis: matched ? "ID-ul explicit al tichetului din sesiune coincide cu ID-ul furnizat." : "Nu există suficiente evenimente pentru a verifica asocierea.",
      evidence_seq: [], evidence_sources: ticketEvidence
    },
    title: "Ciornă indisponibilă", applicability: [], prerequisites: [], steps: [], conditions: [], exceptions: [],
    uncertainties: [{ question: "Ce proces de business a fost rezolvat?", reason, evidence_seq: [], evidence_sources: [] }],
    outcome: null, sufficient_evidence: false, missing_information: [reason]
  };
}
function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const parts = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) if (content.type === "output_text" && typeof content.text === "string") parts.push(content.text);
  }
  return parts.join("\n");
}
// AI_PROVIDER=openai|gemini picks the provider explicitly; otherwise OpenAI if its key is set, else Gemini.
function aiProvider() {
  const explicit = String(process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "openai" || explicit === "gemini") return explicit;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}
export function aiConfigured() {
  const provider = aiProvider();
  if (provider === "openai") return !!process.env.OPENAI_API_KEY;
  if (provider === "gemini") return !!process.env.GEMINI_API_KEY;
  return false;
}
// Gemini's free tier is often overloaded on the big models, so try a chain of models: GEMINI_MODEL
// first, then GEMINI_FALLBACK_MODELS, moving on after a timeout or an "overloaded"/rate-limit error.
const GEMINI_RETRYABLE = new Set([403, 404, 408, 429, 500, 502, 503, 504]); // 403/404: model not available to this project
async function callGemini({ schema, instructions, input }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Setează GEMINI_API_KEY în mediul serverului înainte de a apela AI-ul.");
  const baseUrl = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const models = [process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    ...String(process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.1-flash-lite,gemini-3.8-flash").split(",")]
    .map((m) => m.trim()).filter((m, i, all) => m && all.indexOf(m) === i);
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 60_000;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: instructions }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema }
  });
  let lastError = null;
  for (const model of models) {
    let response;
    try {
      response = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      lastError = new Error(`Gemini (${model}) nu a răspuns în ${Math.round(timeoutMs / 1000)} s.`);
      continue;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      lastError = new Error(`Gemini API ${response.status} (${model}): ${data.error?.message ?? "cererea a eșuat"}`);
      if (GEMINI_RETRYABLE.has(response.status)) continue;
      throw lastError;
    }
    if (data.promptFeedback?.blockReason) throw new Error(`Gemini a blocat cererea (${data.promptFeedback.blockReason}).`);
    const candidate = data.candidates?.[0];
    // Thinking models may return thought parts; only the answer parts hold the JSON.
    const text = (candidate?.content?.parts ?? []).filter((part) => !part.thought).map((part) => part.text ?? "").join("");
    if (!text) {
      lastError = new Error(`Gemini (${model}) nu a returnat conținut JSON (finishReason: ${candidate?.finishReason ?? "necunoscut"}).`);
      continue;
    }
    return JSON.parse(text);
  }
  throw lastError ?? new Error("Niciun model Gemini nu este configurat.");
}
async function callStructuredModel({ name, schema, instructions, input }) {
  if (aiProvider() === "gemini") return callGemini({ schema, instructions, input });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Setează OPENAI_API_KEY în mediul serverului înainte de a apela AI-ul.");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini", instructions, input: JSON.stringify(input),
      text: { format: { type: "json_schema", name, strict: true, schema } }
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${body.error?.message ?? "cererea a eșuat"}`);
  if (body.status !== "completed") throw new Error(`Răspunsul AI nu s-a finalizat (status: ${body.status ?? "necunoscut"}).`);
  const text = outputText(body);
  if (!text) throw new Error("Modelul nu a returnat conținut JSON.");
  return JSON.parse(text);
}
// Fills fields a provider without strict schema enforcement (Gemini) may leave out.
function normalizeDraft(draft) {
  const d = draft && typeof draft === "object" ? draft : {};
  for (const key of ["applicability", "prerequisites", "steps", "conditions", "exceptions", "uncertainties", "missing_information"]) {
    if (!Array.isArray(d[key])) d[key] = [];
  }
  d.session_summary = typeof d.session_summary === "string" ? d.session_summary : "";
  d.title = typeof d.title === "string" && d.title.trim() ? d.title : "Ciornă de procedură";
  if (!d.ticket_link || typeof d.ticket_link !== "object") d.ticket_link = { ticket_id: null, match_status: "unmatched", basis: "", evidence_seq: [], evidence_sources: [] };
  if (d.outcome === undefined) d.outcome = null;
  d.sufficient_evidence = d.sufficient_evidence === true;
  const fixRefs = (item) => {
    if (!Array.isArray(item.evidence_seq)) item.evidence_seq = [];
    if (!Array.isArray(item.evidence_sources)) item.evidence_sources = [];
  };
  for (const key of ["applicability", "prerequisites", "conditions", "exceptions", "steps", "uncertainties"]) d[key].forEach(fixRefs);
  d.steps.forEach((step, index) => { if (!Number.isInteger(step.order)) step.order = index + 1; });
  if (d.outcome) fixRefs(d.outcome);
  fixRefs(d.ticket_link);
  return d;
}
function enforceReviewBoundary(draft, validSeqs, validStepIds, ticketId, meeting = false) {
  const cleanRefs = (refs) => (refs ?? []).filter((seq) => validSeqs.has(seq));
  const cleanSources = (refs) => (refs ?? []).filter((source) => {
    if (!source || typeof source.source_id !== "string") return false;
    if (source.source_type === "capture_step") return validStepIds.has(source.source_id) && (source.seq == null || validSeqs.has(source.seq));
    if (source.source_type === "ticket") return !!ticketId && source.source_id === ticketId;
    return false;
  });
  const guard = (item, textKey) => {
    item.evidence_seq = cleanRefs(item.evidence_seq);
    item.evidence_sources = cleanSources(item.evidence_sources);
    const hasStepEvidence = item.evidence_seq.length > 0 || item.evidence_sources.some((source) => source.source_type === "capture_step");
    if (item.status === "Confirmat") {
      item.status = "Neconfirmat";
      item.reason = "AI-ul nu poate confirma singur; este necesară validarea unei persoane sau a unei surse autorizate.";
    }
    if (item.status === "Observat" && meeting && hasStepEvidence) {
      item.status = "Deducție AI";
      item.reason = "Pasul este descris într-o discuție (ședință sau chat), nu observat direct; trebuie confirmat de cineva.";
    }
    if (item.status === "Observat" && !hasStepEvidence) {
      item.status = "Neconfirmat";
      item.reason = "Afirmația nu are o referință validă la un eveniment observat.";
    }
    if (!item[textKey]?.trim()) item[textKey] = "Informație neprecizată.";
  };
  for (const key of ["applicability", "prerequisites", "conditions", "exceptions"]) for (const item of draft[key]) guard(item, "text");
  for (const item of draft.steps) guard(item, "instruction");
  if (draft.outcome) guard(draft.outcome, "text");
  for (const item of draft.uncertainties) {
    item.evidence_seq = cleanRefs(item.evidence_seq);
    item.evidence_sources = cleanSources(item.evidence_sources);
  }
  draft.ticket_link.evidence_seq = cleanRefs(draft.ticket_link.evidence_seq);
  draft.ticket_link.evidence_sources = cleanSources(draft.ticket_link.evidence_sources);
  return draft;
}
export async function generateProcedureDraft(input) {
  const capture = prepareCapture(input);
  if (capture.events.length === 0) return fallbackDraft(capture, "Exportul nu conține acțiuni sau erori relevante.");
  const explicitSessionTicket = capture.session.ticket_id;
  const explicitTicket = capture.ticket?.ticket_id;
  const draft = normalizeDraft(await callStructuredModel({
    name: "nod_procedure_draft", schema: PROCEDURE_SCHEMA,
    instructions: capture.session.source === "meeting" ? SYSTEM_INSTRUCTIONS + MEETING_INSTRUCTIONS : SYSTEM_INSTRUCTIONS,
    input: { session: capture.session, ticket: capture.ticket, events: capture.events }
  }));
  if (explicitSessionTicket && explicitTicket && explicitSessionTicket === explicitTicket) {
    draft.ticket_link = { ticket_id: explicitTicket, match_status: "matched", basis: "ID-ul explicit al tichetului din sesiune coincide cu ID-ul furnizat.", evidence_seq: [], evidence_sources: [{ source_type: "ticket", source_id: explicitTicket, seq: null }] };
  } else if (explicitSessionTicket && explicitTicket && explicitSessionTicket !== explicitTicket) {
    draft.ticket_link = { ticket_id: explicitTicket, match_status: "unmatched", basis: "ID-ul tichetului din sesiune nu coincide cu tichetul furnizat.", evidence_seq: [], evidence_sources: [{ source_type: "ticket", source_id: explicitTicket, seq: null }] };
  } else if (!capture.ticket) {
    draft.ticket_link = { ticket_id: null, match_status: "unmatched", basis: "Nu a fost furnizat context de tichet.", evidence_seq: [], evidence_sources: [] };
  } else if (draft.ticket_link.match_status === "matched" && (!explicitSessionTicket || !explicitTicket)) {
    draft.ticket_link.match_status = "candidate";
    draft.ticket_link.basis = "Asocierea nu este susținută de un ID explicit al tichetului în sesiune.";
  }
  if (capture.session.status === "active" || capture.session.status === "aborted") {
    draft.sufficient_evidence = false;
    const note = capture.session.status === "active" ? "Sesiunea de captură este încă activă." : "Sesiunea a fost oprită înainte de finalizare.";
    if (!draft.missing_information.includes(note)) draft.missing_information.push(note);
  }
  return enforceReviewBoundary(draft, new Set(capture.events.map((event) => event.seq)), new Set(capture.events.map((event) => event.source_id).filter(Boolean)), capture.ticket?.ticket_id ?? null, capture.session.source === "meeting");
}

export async function searchProcedures(query, procedures, { limit = 5 } = {}) {
  const available = (procedures ?? []).filter((item) => item && typeof item === "object" && !Array.isArray(item) && item.published === true && item.allowed === true && typeof item.procedure_id === "string");
  if (!String(query ?? "").trim() || available.length === 0) return { matches: [], needs_clarification: true, clarification_question: "Ce problemă sau activitate vrei să rezolvi?" };
  const result = await callStructuredModel({
    name: "nod_procedure_search", schema: SEARCH_SCHEMA,
    instructions: "Potrivește întrebarea cu procedurile publicate. Respectă aplicația și condițiile. Nu inventa proceduri. Returnează numai ID-uri primite. Dacă potrivirea este slabă, cere clarificări. Răspunde în română.",
    input: {
      query: redactText(query),
      procedures: available.map(({ procedure_id, title, summary, applicability, application }) => ({ procedure_id, title: redactText(title), summary: redactText(summary), applicability: redactText(applicability), application: redactText(application) }))
    }
  });
  const ids = new Set(available.map((item) => item.procedure_id));
  if (!Array.isArray(result.matches)) result.matches = [];
  result.matches = result.matches.filter((match) => ids.has(match.procedure_id)).slice(0, Math.max(1, limit));
  if (result.matches.length === 0) result.needs_clarification = true;
  return result;
}

export function evaluateDraft(draft, knownEvents, expected = {}) {
  const sources = new Map((knownEvents ?? []).map((item, index) => {
    const event = item?.event && typeof item.event === "object" ? item.event : item;
    const seq = Number.isInteger(item?.seq) ? item.seq : (Number.isInteger(event?.seq) ? event.seq : index + 1);
    const id = typeof event?.id === "string" ? event.id : (typeof item?.source_id === "string" ? item.source_id : null);
    const action = event?.kind === "action" || ["navigation", "click", "input", "select", "toggle", "submit", "keypress"].includes(event?.type);
    return [seq, { action, id }];
  }));
  const validStepIds = new Set([...sources.values()].map((source) => source.id).filter(Boolean));
  const ticketId = typeof expected.ticketId === "string" ? expected.ticketId : draft?.ticket_link?.ticket_id;
  const validSource = (source) => {
    if (!source || typeof source.source_id !== "string") return false;
    if (source.source_type === "capture_step") return validStepIds.has(source.source_id) && (source.seq == null || sources.has(source.seq));
    if (source.source_type === "ticket") return !!ticketId && source.source_id === ticketId;
    return false;
  };

  const factualClaims = [];
  for (const key of ["applicability", "prerequisites", "conditions", "exceptions"]) factualClaims.push(...(draft?.[key] ?? []));
  factualClaims.push(...(draft?.steps ?? []));
  if (draft?.outcome) factualClaims.push(draft.outcome);
  const uncertainties = draft?.uncertainties ?? [];
  let invalidEvidence = 0, unsupportedClaims = 0, observedWithoutEvidence = 0, unreviewedConfirmed = 0, citedClaims = 0;
  const citedActionSeqs = new Set();
  for (const claim of factualClaims) {
    const refs = claim.evidence_seq ?? [];
    const evidenceSources = claim.evidence_sources ?? [];
    const invalidRefs = refs.filter((seq) => !sources.has(seq));
    const invalidSources = evidenceSources.filter((source) => !validSource(source));
    if (invalidRefs.length || invalidSources.length) invalidEvidence += 1;
    const validRefs = refs.filter((seq) => sources.has(seq));
    const validSources = evidenceSources.filter(validSource);
    if (validRefs.length || validSources.length) citedClaims += 1;
    else unsupportedClaims += 1;
    const hasStepEvidence = validRefs.length > 0 || validSources.some((source) => source.source_type === "capture_step");
    if (claim.status === "Observat" && !hasStepEvidence) observedWithoutEvidence += 1;
    if (claim.status === "Confirmat") unreviewedConfirmed += 1;
    for (const seq of validRefs) if (sources.get(seq).action) citedActionSeqs.add(seq);
    for (const source of validSources) {
      if (source.source_type === "capture_step" && source.seq != null && sources.get(source.seq)?.action) citedActionSeqs.add(source.seq);
    }
  }
  for (const uncertainty of uncertainties) {
    if ((uncertainty.evidence_seq ?? []).some((seq) => !sources.has(seq)) || (uncertainty.evidence_sources ?? []).some((source) => !validSource(source))) invalidEvidence += 1;
  }
  if ((draft?.ticket_link?.evidence_seq ?? []).some((seq) => !sources.has(seq)) || (draft?.ticket_link?.evidence_sources ?? []).some((source) => !validSource(source))) invalidEvidence += 1;

  const stepText = (draft?.steps ?? []).map((step) => String(step.instruction ?? "").toLocaleLowerCase("ro")).join(" ");
  const required = Array.isArray(expected.requiredStepTerms) ? expected.requiredStepTerms : [];
  const covered = required.filter((term) => stepText.includes(String(term).toLocaleLowerCase("ro")));
  const stepCoverage = required.length ? covered.length / required.length : null;
  const citationCoverage = factualClaims.length ? citedClaims / factualClaims.length : null;
  const actionCount = [...sources.values()].filter((source) => source.action).length;
  const actionSourceCoverage = actionCount ? citedActionSeqs.size / actionCount : null;
  const expectedTicketId = typeof expected.ticketId === "string" ? expected.ticketId : null;
  const ticketMatchCorrect = expectedTicketId ? draft?.ticket_link?.ticket_id === expectedTicketId : null;
  const groundingScore = citationCoverage === null ? null : Math.round(citationCoverage * 100);
  const referenceComponents = [];
  if (stepCoverage !== null) referenceComponents.push(stepCoverage);
  if (ticketMatchCorrect !== null) referenceComponents.push(ticketMatchCorrect ? 1 : 0);
  const referenceScore = referenceComponents.length ? Math.round(referenceComponents.reduce((sum, value) => sum + value, 0) / referenceComponents.length * 100) : null;

  return {
    grounding_score: groundingScore,
    reference_score: referenceScore,
    metrics: { claim_citation_coverage: citationCoverage, action_source_coverage: actionSourceCoverage, expected_step_coverage: stepCoverage, expected_ticket_match: ticketMatchCorrect },
    checks: {
      all_evidence_references_valid: invalidEvidence === 0,
      all_claims_have_evidence: unsupportedClaims === 0,
      observed_claims_have_evidence: observedWithoutEvidence === 0,
      no_ai_claim_marked_confirmed: unreviewedConfirmed === 0,
      sufficient_evidence: draft?.sufficient_evidence === true
    },
    counts: { invalid_evidence_items: invalidEvidence, unsupported_claims: unsupportedClaims, observed_without_evidence: observedWithoutEvidence, unreviewed_confirmed_claims: unreviewedConfirmed },
    missing_step_terms: required.filter((term) => !covered.includes(term)),
    score_note: referenceScore === null ? "Scorul de completitudine cere pași așteptați sau un tichet de referință." : null
  };
}
export function confirmClaim(claim, reviewerId) {
  if (!reviewerId || typeof reviewerId !== "string") throw new TypeError("Este necesar ID-ul persoanei care confirmă.");
  return { ...claim, status: "Confirmat", confirmed_by: reviewerId, confirmed_at: new Date().toISOString() };
}

















