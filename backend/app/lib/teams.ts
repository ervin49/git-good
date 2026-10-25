// Teams conversations pasted into Helpy: parsed into messages, redacted, stored like a meeting
// (meetings.source = 'teams') so the same AI pipeline turns them into a cited procedure.
import { randomUUID } from "node:crypto";
import { batch } from "@/app/lib/db";
import { redactDeep } from "@/app/lib/redact";

export interface TeamsMessage {
  author: string;
  time: string | null;
  text: string;
}

const MAX_MESSAGES = 500;
const MAX_CHARS = 30_000;
const TIME = String.raw`\d{1,2}:\d{2}(?:\s?[AaPp][Mm])?`;
const TICKET_RE = /\b[A-Z][A-Z0-9]{1,9}-\d{1,7}\b/g;

// "10:14 Ana: text", "[10:14] Ana: text", "Ana: text"
const INLINE = new RegExp(String.raw`^\[?(${TIME})\]?\s+([^:]{1,60}):\s*(.+)$`);
const AUTHOR_ONLY = /^([^:[\]]{1,60}):\s*(.+)$/;
// Teams copy-paste headers: "[10:14] Ana Merecioni" or "Ana Merecioni 10:14" (optionally with a date)
const HEADER_TIME_FIRST = new RegExp(String.raw`^\[(${TIME})\]\s+(.{1,60})$`);
const HEADER_NAME_FIRST = new RegExp(String.raw`^(.{1,60}?),?\s+(?:\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?,?\s+)?(${TIME})$`);

function clean(text: string): string {
  return (redactDeep(text) as string).replace(/\s+/g, " ").trim();
}

export function parseTeamsTranscript(raw: string): TeamsMessage[] {
  const messages: TeamsMessage[] = [];
  let current: TeamsMessage | null = null;
  const push = (m: TeamsMessage) => {
    current = m;
    messages.push(m);
  };
  for (const line of raw.slice(0, MAX_CHARS).split(/\r?\n/).map((l) => l.trim())) {
    if (!line) continue;
    let m = line.match(INLINE);
    if (m) { push({ time: m[1], author: m[2].trim(), text: m[3] }); continue; }
    m = line.match(HEADER_TIME_FIRST);
    if (m) { push({ time: m[1], author: m[2].trim(), text: "" }); continue; }
    m = line.match(HEADER_NAME_FIRST);
    if (m && !/[.!?]$/.test(m[1])) { push({ time: m[2], author: m[1].trim(), text: "" }); continue; }
    m = line.match(AUTHOR_ONLY);
    if (m && !/\s{2,}/.test(m[1]) && m[1].split(/\s+/).length <= 4) { push({ time: null, author: m[1].trim(), text: m[2] }); continue; }
    const open = current as TeamsMessage | null;
    if (open) open.text = open.text ? `${open.text} ${line}` : line;
    else push({ time: null, author: "Participant", text: line });
  }
  return messages
    .filter((m) => m.text.trim())
    .slice(0, MAX_MESSAGES)
    .map((m) => ({ author: clean(m.author).slice(0, 80) || "Participant", time: m.time, text: clean(m.text).slice(0, 2000) }));
}

export function findTicketIds(text: string): string[] {
  return [...new Set(text.match(TICKET_RE) ?? [])].slice(0, 20);
}

function toSeconds(time: string | null): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})\s?([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 3600 + Number(m[2]) * 60;
}

// Stores the conversation as a meeting with source 'teams'; returns its id.
export async function saveTeamsConversation(title: string, messages: TeamsMessage[], ticketIds: string[]): Promise<string> {
  const id = `teams-${randomUUID()}`;
  const now = new Date().toISOString();
  const authors = new Set(messages.map((m) => m.author));
  const base = toSeconds(messages.find((m) => m.time)?.time ?? null) ?? 0;
  await batch([
    {
      sql: `INSERT INTO meetings (id, source, title, date, duration_min, transcript_url, participant_count, ticket_ids, overview, action_items, keywords, synced_at)
      VALUES (?, 'teams', ?, ?, 0, NULL, ?, ?, '', '[]', '[]', ?)`,
      args: [id, clean(title).slice(0, 300) || "Conversație Teams", now, authors.size, JSON.stringify(ticketIds), now],
    },
    ...messages.map((m, i) => {
      const t = toSeconds(m.time);
      return {
        sql: "INSERT INTO meeting_sentences (meeting_id, idx, speaker, text, start_s, end_s) VALUES (?, ?, ?, ?, ?, NULL)",
        args: [id, i, m.author, m.text, t === null ? null : Math.max(0, t - base)],
      };
    }),
  ]);
  return id;
}
