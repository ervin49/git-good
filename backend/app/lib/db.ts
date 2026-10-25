// Database: libSQL (SQLite-compatible). In production it is a Turso database (TURSO_DATABASE_URL +
// TURSO_AUTH_TOKEN), which persists across serverless instances. Without those variables it falls back
// to a local file (backend/data/gitgood.db, or DATABASE_PATH), so local development needs no setup.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient, type Client, type InValue } from "@libsql/client";

function localUrl(): string {
  // On Vercel only /tmp is writable and it is ephemeral; set TURSO_DATABASE_URL there.
  const defaultDir = process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), "data");
  const file = process.env.DATABASE_PATH ?? path.join(defaultDir, "gitgood.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return `file:${file}`;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS allowed_domains (
    domain     TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    href       TEXT,
    created_at TEXT NOT NULL,
    read_at    TEXT
  );
  CREATE TABLE IF NOT EXISTS procedures (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    summary         TEXT NOT NULL DEFAULT '',
    ticket_id       TEXT,
    source_type     TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    steps           TEXT NOT NULL,
    outcome         TEXT,
    grounding_score REAL,
    approved_by     TEXT NOT NULL,
    approved_at     TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meetings (
    id                TEXT PRIMARY KEY,
    source            TEXT NOT NULL DEFAULT 'fireflies',
    title             TEXT NOT NULL,
    date              TEXT NOT NULL,
    duration_min      REAL NOT NULL DEFAULT 0,
    transcript_url    TEXT,
    participant_count INTEGER NOT NULL DEFAULT 0,
    ticket_ids        TEXT NOT NULL DEFAULT '[]',
    overview          TEXT NOT NULL DEFAULT '',
    action_items      TEXT NOT NULL DEFAULT '[]',
    keywords          TEXT NOT NULL DEFAULT '[]',
    synced_at         TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meeting_sentences (
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    idx        INTEGER NOT NULL,
    speaker    TEXT NOT NULL,
    text       TEXT NOT NULL,
    start_s    REAL,
    end_s      REAL,
    PRIMARY KEY (meeting_id, idx)
  );
  CREATE TABLE IF NOT EXISTS integration_state (
    name       TEXT PRIMARY KEY,
    last_sync  TEXT,
    last_error TEXT
  );
  CREATE TABLE IF NOT EXISTS meeting_drafts (
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    ticket_id  TEXT NOT NULL DEFAULT '',
    draft      TEXT NOT NULL,
    quality    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (meeting_id, ticket_id)
  );
  CREATE TABLE IF NOT EXISTS capture_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT NOT NULL,
    session_id  TEXT NOT NULL,
    origin      TEXT,
    event       TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS capture_events_session ON capture_events (session_id);
  CREATE TABLE IF NOT EXISTS request_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    at          TEXT NOT NULL,
    method      TEXT NOT NULL,
    status      INTEGER NOT NULL,
    session_id  TEXT,
    origin      TEXT,
    event_count INTEGER NOT NULL,
    error       TEXT
  );
`;

interface Connection {
  client: Client;
  ready: Promise<void>;
}

// Stash on globalThis so dev HMR doesn't open a new connection on every reload.
const g = globalThis as unknown as { __nodDb?: Connection };
function connect(): Connection {
  const url = process.env.TURSO_DATABASE_URL || localUrl();
  console.log(`[db] ${url.startsWith("file:") ? "local file" : "remote " + url.split("://")[0]}`);
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
  const ready = client.executeMultiple(SCHEMA);
  ready.catch(() => { g.__nodDb = undefined; }); // retry on the next request if the first attempt failed
  return { client, ready };
}

function conn(): Connection {
  return (g.__nodDb ??= connect());
}

async function ready(): Promise<Client> {
  const c = conn();
  await c.ready;
  return c.client;
}

export type Row = Record<string, unknown>;
export type Statement = { sql: string; args?: InValue[] };

export async function all<T = Row>(sql: string, args: InValue[] = []): Promise<T[]> {
  const rs = await (await ready()).execute({ sql, args });
  return rs.rows.map((row) => Object.fromEntries(rs.columns.map((col, i) => [col, row[i]])) as T);
}

export async function get<T = Row>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: InValue[] = []): Promise<{ changes: number }> {
  const rs = await (await ready()).execute({ sql, args });
  return { changes: rs.rowsAffected };
}

// Runs the statements in one transaction.
export async function batch(statements: Statement[]): Promise<void> {
  if (statements.length) await (await ready()).batch(statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })), "write");
}

export interface AllowedDomain {
  domain: string;
  created_at: string;
}

// Accepts "app.firma.ro", "*.firma.ro", "localhost", an IPv4 or a pasted URL; returns the bare host or null.
// Keep in sync with capture-extension/src/allowlist.js, which reads this list.
export function normalizeDomain(raw: unknown): string | null {
  const host = String(raw ?? "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[/?#:]/)[0];
  if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  return /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/.test(host) ? host : null;
}

export async function listDomains(): Promise<AllowedDomain[]> {
  return all<AllowedDomain>("SELECT domain, created_at FROM allowed_domains ORDER BY created_at, domain");
}

// Returns false when the domain was already stored.
export async function addDomain(domain: string): Promise<boolean> {
  const result = await run("INSERT OR IGNORE INTO allowed_domains (domain, created_at) VALUES (?, ?)", [domain, new Date().toISOString()]);
  return result.changes > 0;
}

export async function removeDomain(domain: string): Promise<boolean> {
  return (await run("DELETE FROM allowed_domains WHERE domain = ?", [domain])).changes > 0;
}
