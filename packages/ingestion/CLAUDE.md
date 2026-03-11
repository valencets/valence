# packages/ingestion

Server-side telemetry ingestion node. Receives payloads from client ring buffers.

## The One Rule

`safeJsonParse()` in `safe-json-parse.ts` is the ONLY `try/catch` in the entire Inertia codebase. Every other function returns `Result<Ok, Err>` via `neverthrow`.

## Pipeline Flow

1. Raw string → `safeJsonParse()` → `Result<unknown, ParseFailure>`
2. Parsed object → Zod `.safeParse()` → `Result<GlobalTelemetryIntent, ValidationFailure>`
3. Chain with `.map()` / `.andThen()`
4. Final `.match()`: Ok → INSERT to PostgreSQL | Err → log + return HTTP 200

## Black Hole Strategy

Always return HTTP 200 OK, even on validation failure. This prevents client retry storms. Bad payloads are logged to internal audit stream and silently dropped.

## Dependencies

- `neverthrow` — Result monads
- `zod` — Runtime schema validation (`.safeParse()` ONLY)
- PostgreSQL client (pg or similar)

## Testing

Test malformed JSON, invalid schemas, missing fields, oversized payloads, and null bodies. Every path must resolve to a typed Result, never an unhandled exception.
