// SQLite database (Node's built-in node:sqlite, no extra dependency). The file lives in
// backend/data/ by default; override with DATABASE_PATH.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "gitgood.db");

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS allowed_domains (
      domain     TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

// Stash on globalThis so dev HMR doesn't open a new connection on every reload.
const g = globalThis as unknown as { __nodDb?: DatabaseSync };
export const db: DatabaseSync = (g.__nodDb ??= open());

export interface AllowedDomain {
  domain: string;
  created_at: string;
}

// Accepts "app.firma.ro", "*.firma.ro", "localhost" or a pasted URL; returns the bare host or null.
export function normalizeDomain(raw: unknown): string | null {
  const host = String(raw ?? "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[/?#:]/)[0];
  if (host === "localhost") return host;
  return /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/.test(host) ? host : null;
}

export function listDomains(): AllowedDomain[] {
  return db.prepare("SELECT domain, created_at FROM allowed_domains ORDER BY created_at, domain").all() as unknown as AllowedDomain[];
}

// Returns false when the domain was already stored.
export function addDomain(domain: string): boolean {
  const result = db
    .prepare("INSERT OR IGNORE INTO allowed_domains (domain, created_at) VALUES (?, ?)")
    .run(domain, new Date().toISOString());
  return result.changes > 0;
}

export function removeDomain(domain: string): boolean {
  return db.prepare("DELETE FROM allowed_domains WHERE domain = ?").run(domain).changes > 0;
}
