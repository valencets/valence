# CLAUDE.md

Read `AGENTS.md` in this directory first — it is the canonical agent guide for this repository
(repo map, conventions, banned patterns, security invariants, commands).

Package-level guides live at `packages/<name>/AGENTS.md`.

Quick reminders that trip up agents most often:

- No `throw` / `try/catch` — use `Result` / `ResultAsync` from `@valencets/resultkit`.
- Zod: `.safeParse()` only. No `switch`, no `enum`, no default exports, no `as any`.
- `pnpm build` before `pnpm test` on a fresh checkout.
- Commits follow the TDD suffix protocol (`-- RED` / `-- GREEN` / `-- REFACTOR`) enforced by hooks and CI.
- Generated files start with `// @generated` — never hand-edit them or `packages/*/*.api.md`.
