# @valencets/reactive — Agent Guide

Zero-dependency signals: `signal`, `computed`, `effect`, `batch`, `untracked`, plus DOM `bind()`.
TC39-aligned pull/push algorithm with Preact-style `.value`. Repo-wide rules: root `AGENTS.md`.

## Modules

- `core.ts` — the whole algorithm. Single notification queue (no recursive snapshots),
  `MAX_NOTIFY_DEPTH = 100` loop guard, effect re-entrancy guard, computed with dirty-flag lazy
  recomputation and `equals` short-circuit (default `Object.is`).
- `bind.ts` — attaches signals to server-rendered DOM: `text`, `value` (two-way; duck-types
  form-associated custom elements via `value`/`checked` properties, so ValElements work),
  `checked`, `visible`, `class`, `attr` (denies `on*` attributes — XSS guard), `disabled`.
  Returns a disposer.
- `sinks.ts` — additional one-way sink helpers.

## Hard rules

- **Callbacks must not throw.** A thrown exception inside `effect`/`computed`/`batch` corrupts
  notify depth and pending sets. Wrap fallible work in `fromThrowable`/`ResultAsync` first.
- Keep the `on*` attribute denylist in `bind.ts` — it prevents `setAttribute('onclick', …)` XSS.
- No allocation-heavy patterns in the notify path; the queue reuse is deliberate.
- This package imports nothing (not even resultkit). Keep it that way.
