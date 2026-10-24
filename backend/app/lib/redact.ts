// Defense-in-depth redaction on the server side. The extension already redacts
// before sending, but the backend must not trust that: anything that looks like
// a secret is scrubbed again here before it is stored. Mirrors the patterns used
// in the extension's @browser-recorder/core redactor.

const PATTERNS: RegExp[] = [
  // JSON web tokens.
  /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g,
  // Authorization: Bearer <token>
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  // key=value / "key":"value" where the key names a credential.
  /\b(?:pass(?:word|wd)?|pwd|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|session[_-]?id|auth)\b["']?\s*[:=]\s*["']?([^"'&\s,}]{3,})/gi,
  // Emails.
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  // Long opaque hex / base64 blobs.
  /\b[A-Fa-f0-9]{32,}\b|\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
];

const REDACTED = "[REDACTED]";

const DROPPED_KEYS = new Set(["value", "requestBody", "responseBody"]);

// capture-extension masks field values locally (passwords, cards, emails… are replaced
// before they leave the browser), so for its batches `value` is kept and only re-scrubbed.
export const CAPTURE_DROPPED_KEYS = new Set(["requestBody", "responseBody"]);

function redactString(text: string): string {
  let out = text;
  for (const re of PATTERNS) {
    out = out.replace(re, REDACTED);
  }
  return out;
}

export function redactDeep(value: unknown, dropped: Set<string> = DROPPED_KEYS): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, dropped));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = dropped.has(k) ? "[REMOVED]" : redactDeep(v, dropped);
    }
    return out;
  }
  return value;
}
