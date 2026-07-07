# @valencets/cms — Agent Guide

The schema engine: one `collection()` definition produces DDL, Zod validators, REST + Local API,
admin UI, auth, and media handling. Largest package in the repo. Repo-wide rules: root `AGENTS.md`.

## Module map

```
src/
├── schema/        # collection(), global(), field.* factories, 22 field types (field-types.ts),
│                  # registry (slug uniqueness, lookup), infer.ts (schema → TS types)
├── validation/    # zod-generator.ts (FieldConfig → Zod, safeParse only), validators (slug/email)
├── db/            # query-builder.ts (chainable, field-allow-listed), safe-query.ts (THE SQL boundary),
│                  # sql-sanitize.ts (identifier allow-listing), column-map.ts (field type → PG column),
│                  # migration-generator.ts (schema diff → SQL), revision-queries, search-migration (tsvector)
├── access/        # per-collection/per-field create/read/update access fns + resolver
├── hooks/         # 11 collection lifecycle hooks + per-field hooks, ordered runners
├── auth/          # password.ts (Argon2id), session.ts (cms_sessions, expiry + soft delete),
│                  # cookie.ts, middleware.ts, rate-limit.ts, token-utils.ts (SHA-256 + timingSafeEqual),
│                  # auth-config.ts (auth:true injects email/password fields), auth-routes.ts
├── api/           # local-api.ts (programmatic CRUD, shares validation/hooks/access),
│                  # rest-api.ts (/api/:slug CRUD + bulk), read-body.ts (size-limited), openapi.ts
├── admin/         # server-rendered admin: layout.ts (shell), list/edit/login/revision/analytics views,
│                  # field-renderers.ts (FieldConfig → HTML input), escape.ts (escapeHtml — use it ALWAYS),
│                  # editor/ (Tiptap bundle — the ONLY third-party browser JS, admin-only)
├── media/         # upload-handler (auth required), serve-handler (public), image-processor (Sharp),
│                  # storage-adapter (pluggable, see plugin-cloud-storage)
├── config/        # buildCms(config) → Result<CmsInstance, CmsError>; plugin.ts (plugins = CmsConfig transformers)
├── scheduler.ts / telemetry-scheduler.ts   # publish_at + daily aggregation timers
└── index.ts
```

`buildCms` returns `{ api, collections, globals, restRoutes, adminRoutes, pluginHooks }` — route Maps of
`path → { GET/POST/PATCH/DELETE }` consumed by the server in `@valencets/valence`.

## Hard rules

- **SQL:** never call `pool.sql` directly — go through `safeQuery` (parameterized, ResultAsync-mapped).
  Any identifier interpolated into SQL must pass `isValidIdentifier` / `isAllowedField`. Values are
  always `$n` parameters. The query builder does this for you; raw `safeQuery` is for auth/session paths.
- **HTML:** every interpolated string in admin views goes through `escapeHtml()`. No exceptions.
- **Bodies:** use `readStringBody`/`readRawBody` from `api/read-body.ts` (size-capped, Result-returning).
- **Auth:** media upload requires a validated `cms_session`; media serve is deliberately public.
  Session cookies: `httpOnly; SameSite=Lax; Secure` (Secure follows transport). CSRF token on all admin forms.
- Admin views are plain HTML strings — no template engine, no client framework. Interactivity comes from
  `@valencets/ui` components and `@valencets/reactive` signals.

## Adding a field type (7 steps, TDD each)

1. `schema/field-types.ts` — add to `FieldType` const + discriminated union
2. `schema/fields.ts` — factory function
3. `db/column-map.ts` — PG column mapping
4. `validation/zod-generator.ts` — Zod schema builder
5. `admin/field-renderers.ts` — HTML renderer
6. `schema/infer.ts` — TS type mapping
7. Check codegen output in `@valencets/valence` (`codegen/type-generator.ts`) still maps the type

## Tests

Mock pools from `src/__tests__/test-helpers.ts` (`makeMockPool`, `makeErrorPool`); no real DB in unit
tests. Real-Postgres coverage lives in root `tests/integration/`.
