# NOD AI prototype

Node.js module that converts a Browser Recorder `events.json` export plus ticket context into a cited, reviewable procedure draft. It calls OpenAI Structured Outputs through the Responses API. There are no package dependencies; API credentials stay server-side.

## Configure

Set in the server process (never in extension code):
- `OPENAI_API_KEY` — required.
- `OPENAI_MODEL` — optional; defaults to `gpt-4.1-mini`.

## Input

`generateProcedureDraft(input)` accepts the recorder export object (or raw merged events array), optionally wrapped as:

```json
{
  "session": { "session_id": "s-1", "ticket_id": "TCK-1", "application": "e-Factura" },
  "ticket": { "ticket_id": "TCK-1", "title": "...", "description": "..." },
  "metadata": { "timestamp": "...", "title": "..." },
  "events": []
}
```

The module keeps actions, console errors, and failed network events. It drops key values, typed values, request/response bodies, headers, and URL query strings; reduces UI targets to generic control types; and never sends the ZIP's DOM snapshots or report. P1 should eventually pass the allowlisted, locally masked export and add `session.ticket_id`.

## Use

```js
import { generateProcedureDraft, searchProcedures, evaluateDraft } from "./ai/processor.mjs";
const draft = await generateProcedureDraft({ session, ticket, metadata, events });
const quality = evaluateDraft(draft, events, { requiredStepTerms: ["serie", "salvează"] });
const results = await searchProcedures("Cum rezolv eroarea de emitere?", publishedProcedures);
```

CLI for one JSON export: `node ai/cli.mjs path/to/export.json`. Ticket context may be included under `ticket` and `session`.

The model cannot confirm a claim; model-generated `Confirmat` is downgraded. Call `confirmClaim(claim, reviewerId)` only after a person reviews it. Every output evidence reference points to an input event `seq` and, when available, the stable capture step ID; ticket-derived claims cite the ticket ID. Quality reports grounding/citation coverage separately from reference-based completeness; the reference score stays null unless expected steps or an expected ticket are supplied. `searchProcedures` filters unpublished/disallowed items before model processing; the caller must apply organization/user access controls first.

## Backend routes added after the latest pull

The Next.js backend now has two server-side endpoints:

- `POST /api/ai/draft` accepts a `sessionId` plus optional ticket context for stored events, or a normalized capture-session.v1 document under `capture` (or as the body). It generates a cited draft and returns a quality report. The live-event path uses up to the latest 1,000 stored events.
- `POST /api/ai/search` with `{ "query": "...", "procedures": [...] }`. Pass only procedures the signed-in user may access; each candidate must have `published: true` and `allowed: true`.

For live-sync batches, the extension includes `metadata.ticket` on its captured steps; the AI uses that explicit ID when matching a supplied ticket. For standalone normalized documents, the ID comes from `session.ticket.external_id`.

Set `OPENAI_API_KEY` in the backend's server environment. The AI routes return 503 when it is missing. Keep the API key out of extension code and Git. These demo routes inherit the backend's current lack of authentication, so protect them before exposing the service beyond the hackathon environment.

## P1 capture-session.v1 support

The processor now accepts the exact document from `capture-extension/schema/capture-session.v1.schema.json` (`session` + `steps`) as well as live-sync records returned by `GET /api/events?sessionId=...`. For normalized captures it uses `session.ticket.external_id`, step `seq`, `description`, `app`, target labels, masking flags, and timestamps. It only sends a step value to the model when the capture marks it unmasked; masked/omitted values stay out.

For `events-batch`, it reads the extension's explicit `metadata.ticket` association from the stored event and can match it to the ticket context. It does not infer a confirmed match from time proximity.

The draft endpoint accepts either `{ "sessionId": "...", ... }` for backend-stored live events, or `{ "capture": { "schema_version": "1.0", "session": ..., "steps": [...] } }` (the capture document may also be sent as the top-level body). The second form is useful for a direct normalized upload or a demo.


