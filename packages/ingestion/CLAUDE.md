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

## TDD Protocol

Write tests BEFORE implementation. Every feature follows red-green-refactor:

1. Write a failing test that specifies the behavior
2. Write the minimum code to make it pass
3. Refactor while keeping tests green

### Test Coverage Requirements

- Test malformed JSON, invalid schemas, missing fields, oversized payloads, and null bodies
- Every path must resolve to a typed Result, never an unhandled exception
- Black Hole: verify HTTP 200 returned for ALL failure modes
- Pipeline: test each stage in isolation AND as composed chain
- Boundary: `safeJsonParse()` must be tested with every known malformed input pattern

### LOC Targets

| Module | Estimated LOC | Test LOC |
|---|---|---|
| `safe-json-parse.ts` | ~30 | ~80 |
| `validate.ts` (Zod schemas) | ~60 | ~100 |
| `pipeline.ts` (monadic chain) | ~80 | ~120 |
| `handler.ts` (HTTP endpoint) | ~50 | ~80 |

Tests should be ~1.5x the implementation LOC.

## Development Order

Build bottom-up: `safe-json-parse` → Zod validation schemas → monadic pipeline composition → HTTP handler. Each module is test-driven and merged only when all tests pass.
