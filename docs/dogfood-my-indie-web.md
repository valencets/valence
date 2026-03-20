# Dogfood Report: my-indie-web

Real-world Valence project — Win2K-themed personal site with 12 collections, WebSocket chat, game sessions, music player, blog, and OSRS proxy.

## Issues Found & Filed

### Bugs (P0-P1)
- **#143** — Trailing-slash URLs return 404 on admin and all CMS routes
- **#144** — `onServer` callback can't import cross-file `.ts` modules (no tsx loader at runtime)
- **#145** — `valence dev` doesn't run project migrations on dev database
- **#146** — `safeQuery` not exported from `@valencets/cms` public API

### Features / Improvements
- **#147** — No built-in session/auth primitives for custom (non-admin) auth
- **#148** — REST API query filtering works but is undocumented

### Already Fixed
- **#140** — Codegen: invalid JS identifiers from hyphenated collection slugs (merged)

## Workarounds Applied

| Issue | Workaround |
|-------|-----------|
| Trailing slash 404 | 301 redirect in `onServer` request handler |
| No tsx at runtime | Inline utility functions — no cross-file `.ts` imports in server code |
| Dev DB migrations | Manual `psql -f migrations/*.sql` against `_dev` database |
| safeQuery missing | Use `pool.sql.unsafe()` with parameterized queries |
| No custom auth | Built full session system: PBKDF2 hashing, SHA-256 tokens, localStorage |
| Undocumented filtering | Read framework source to discover `/api/posts?slug=X` |

## What Worked Well
- `onServer` callback is powerful — WebSocket, custom routes, rate limiting all wired up cleanly
- Collection schema with field types covers all use cases (12 collections, all 18 field types)
- `createRateLimiter` from CMS works perfectly for HTTP rate limiting
- Admin panel is solid for content management
- REST API with query filtering is excellent once discovered
- `auth: true` on collections handles password hashing and email fields automatically
