<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark-animated.png">
    <source media="(prefers-color-scheme: light)" srcset="./assets/logo-light-animated.png">
    <img alt="Valence" src="./assets/logo-light-animated.png" width="280">
  </picture>
</p>

<p align="center"><strong>Schema-driven full-stack framework for Node.js and PostgreSQL.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@valencets/valence"><img src="https://img.shields.io/npm/v/@valencets/valence" alt="npm"></a>
  <a href="https://socket.dev/npm/package/@valencets/valence"><img src="https://socket.dev/api/badge/npm/package/@valencets/valence" alt="Socket"></a>
  <a href="https://github.com/valencets/valence/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/valencets/valence/ci.yml?branch=master&label=CI" alt="CI"></a>
  <a href="https://github.com/valencets/valence/blob/master/LICENSE"><img src="https://img.shields.io/github/license/valencets/valence" alt="License"></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <a href="https://github.com/neostandard/neostandard"><img src="https://img.shields.io/badge/code_style-neostandard-brightgreen?style=flat" alt="neostandard"></a>
</p>

---

> **Status: Pre-1.0.** Valence is in active development. The API surface is stabilizing but breaking changes may occur. Security hardening is in progress. Not recommended for production deployments yet.

Define collections and fields in one TypeScript config. Valence derives database tables, a server-rendered admin panel, REST and GraphQL APIs, typed routes with loaders and actions, entity codegen, database migrations, and a first-party analytics pipeline from that single schema. No runtime framework on public pages. No vendor scripts. Minimal, audited dependencies.

```typescript
// valence.config.ts
import { defineConfig, collection, field } from '@valencets/valence'

export default defineConfig({
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'mysite',
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? ''
  },
  server: { port: Number(process.env.PORT ?? 3000) },
  collections: [
    collection({
      slug: 'posts',
      labels: { singular: 'Post', plural: 'Posts' },
      versions: { drafts: true },
      hooks: {
        afterChange: [({ doc }) => console.log('saved', doc.id)]
      },
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', slugFrom: 'title', unique: true }),
        field.richtext({ name: 'body' }),
        field.tabs({
          tabs: [
            {
              label: 'Details',
              fields: [
                field.boolean({ name: 'published' }),
                field.date({ name: 'publishedAt', condition: (data) => data.published === 'true' })
              ]
            },
            {
              label: 'SEO',
              fields: [
                field.text({ name: 'metaTitle' }),
                field.textarea({ name: 'metaDescription' })
              ]
            }
          ]
        })
      ]
    }),
    collection({
      slug: 'users',
      auth: true,
      fields: [
        field.text({ name: 'name', required: true }),
        field.select({
          name: 'role',
          defaultValue: 'editor',
          access: { update: ({ user }) => user.role === 'admin' },
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'Editor', value: 'editor' }
          ]
        })
      ]
    })
  ],
  routes: [
    {
      path: '/blog/:slug',
      collection: 'posts',
      type: 'detail',
      loader: async ({ params, pool }) => {
        const post = await pool`SELECT * FROM posts WHERE slug = ${params.slug}`
        return { data: { post: post[0] } }
      }
    },
    {
      path: '/contact',
      method: 'POST',
      action: async ({ body }) => {
        return { redirect: '/thank-you' }
      }
    }
  ],
  onServer ({ server, pool, cms, registerRoute }) {
    registerRoute('GET', '/api/health', (_req, res) => {
      res.writeHead(200).end('ok')
    })
  },
  admin: { pathPrefix: '/admin', requireAuth: true },
  graphql: true,
  telemetry: {
    enabled: true,
    endpoint: '/api/telemetry',
    siteId: 'mysite'
  }
})
```

That config gives you: `posts` and `users` tables in Postgres, a server-rendered admin panel with form validation and session auth (Argon2id), a REST API at `/api/posts` and `/api/users`, a GraphQL endpoint at `/graphql`, typed routes with loaders and actions, an `onServer` hook for custom routes and WebSocket handlers, a typed `src/` scaffold with entity interfaces and API clients, Zod validators, database migrations, draft versioning with revision history, and a first-party analytics pipeline that tracks user intent without any third-party scripts on your public pages. One schema to rule them all.

## Quick Start

```bash
npx @valencets/valence init my-site
cd my-site
pnpm dev
```

The init wizard walks you through database setup, admin user creation, optional seed data, and framework choice (plain HTML templates, Astro, or bring your own). Pass `--yes` to skip prompts and accept defaults.

Open `http://localhost:3000/admin` to sign in. Open `http://localhost:3000` for the landing page.

## What You Get

### Schema Engine

- **Database tables** derived from your field definitions. UUID primary keys, timestamps, soft deletes.
- **22 field types.** text, textarea, richtext, number, boolean, select, date, slug, media, relation, group, email, url, password, json, color, multiselect, array, blocks, tabs, row, collapsible.
- **Layout fields.** Tabs, rows, and collapsible sections for organizing complex admin forms without affecting the database schema.
- **Conditional fields.** Show or hide fields based on other field values using the `condition` function.
- **Field access control.** Per-field create, read, and update access control functions that receive the current user context.
- **Field hooks.** `beforeValidate`, `beforeChange`, `afterChange`, `afterRead` hooks on individual fields.
- **Globals.** Single-document configs (site settings, navigation, footer) via `global()` with the same field system.
- **Migrations** generated from schema diffs. Deterministic SQL, idempotent, version-tracked.

### Admin Panel

- **Server-rendered** admin at `/admin`. HTML forms, CSRF protection, session auth with Argon2id.
- **Rich text editor.** Tiptap-powered (ProseMirror) with heading, list, blockquote, link, code, divider, and code block formatting. Slash command menu for block insertion.
- **Draft versioning.** Enable `versions: { drafts: true }` on a collection for publish/unpublish workflow with revision history and diff view.
- **Autosave.** Automatic draft saving with visual indicator via the `<val-autosave>` component.
- **Live preview.** Split-pane editor with real-time preview iframe via postMessage.
- **Bulk operations.** Select multiple documents in list view for bulk delete, publish, or unpublish.
- **Image processing.** Automatic image resizing and optimization via Sharp on media upload.

### API Layer

- **REST API** at `/api/:collection`. CRUD with Zod validation, parameterized queries, `Result<T, E>` error handling.
- **GraphQL API.** Auto-generated schema from collections with resolvers wired to the Local API. Enable with `graphql: true`.
- **Local API.** Programmatic access to all CRUD operations with the same validation and hooks as the REST layer.
- **Full-text search.** PostgreSQL tsvector/tsquery with relevance ranking, configurable per collection.

### Routing

- **Page routing.** `src/pages/` maps to URL paths.
- **Routes with loaders.** Server-side data loading injected into pages.
- **Routes with actions.** Form handling that returns redirects or field-level errors.
- **`onServer` hook.** Access the raw `http.Server`, database pool, CMS instance, and `registerRoute` for custom endpoints or WebSocket upgrade handlers.
- **View transitions.** Built-in presets for smooth page navigation.

### Frontend

- **23 Web Components.** ARIA-compliant, i18n-ready, telemetry hooks, hydration directives. OKLCH design tokens. Zero dependencies.
- **Entity codegen.** Typed interfaces and API clients generated from your schema. `// @generated` files regenerate on config change; user-edited files are never overwritten.
- **Static file serving.** `public/` served with MIME types and path traversal protection.

### Security

- Argon2id password hashing for admin authentication.
- CSRF protection on admin forms (double-submit cookie with `crypto.randomBytes`).
- Session auth with `httpOnly`, `Secure`, `SameSite=Strict` cookie flags.
- Path traversal protection on static file serving, media uploads, and cloud storage.
- URL redirect validation to prevent open redirect attacks.
- Parameterized SQL everywhere. No string concatenation in queries.
- CodeQL and Socket auditing in CI.

### Telemetry

First-party analytics that runs entirely in your Postgres. No Google Analytics, no Plausible, no third-party scripts on your public pages. Your data stays in your database.

Annotate HTML elements with `data-telemetry-*` attributes. The client library captures events in a pre-allocated ring buffer (zero allocation in the hot path) and auto-flushes via `navigator.sendBeacon()`. The server ingests payloads, stores raw events, and aggregates into daily summaries.

11 intent types: CLICK, SCROLL, VIEWPORT_INTERSECT, FORM_INPUT, INTENT_NAVIGATE, INTENT_CALL, INTENT_BOOK, INTENT_LEAD, LEAD_PHONE, LEAD_EMAIL, LEAD_FORM.

### Plugins

- `@valencets/plugin-seo` — auto-title, meta field injection.
- `@valencets/plugin-nested-docs` — tree structures with breadcrumb computation.
- `@valencets/plugin-cloud-storage` — S3-compatible object storage adapter.

Plugins are config transformers: a function that receives a `CmsConfig` and returns a modified `CmsConfig`.

## Packages

| Package | What it does | External deps |
|---------|-------------|---------------|
| `@valencets/ui` | 23 Web Components. ARIA, i18n, telemetry hooks, hydration directives. OKLCH tokens. | none |
| `@valencets/core` | Router + server. pushState nav, fragment swaps, prefetch, view transitions, server islands. | neverthrow |
| `@valencets/db` | PostgreSQL query layer. Tagged template SQL, parameterized queries, `Result<T,E>`, migration runner. | postgres, neverthrow, zod |
| `@valencets/cms` | Schema engine. `collection()` + `field.*` produces tables, validators, REST API, admin UI, auth, media. Rich text via Tiptap. | tiptap, argon2, sharp, zod, neverthrow |
| `@valencets/graphql` | Auto-generated GraphQL schema + resolvers from CMS collections. | graphql, neverthrow |
| `@valencets/telemetry` | Beacon ingestion, event storage, daily summaries, fleet aggregation. | postgres, neverthrow |
| `@valencets/valence` | CLI + FSD scaffold + entity codegen + route types. | tsx, zod, neverthrow |

Core external runtime deps: 8. All MIT-licensed, all audited via Socket. Public-facing pages ship zero third-party JavaScript.

## Constraints

| Rule | Why |
|------|-----|
| Complexity < 20 | Every function fits on one screen. |
| `Result<T, E>` everywhere | If it can fail, the type says so. Both branches handled. |
| 14kB critical shell | First paint in the first TCP round trip. |
| Pre-allocated ring buffer | Zero allocation in the telemetry hot path. |
| Zero third-party JS on public pages | Your site ships your code. Tiptap is admin-only. |
| 3,022 tests | Strict TypeScript, neostandard, CI on every push. |

## Current Status

Valence is pre-1.0 and in active development. The schema engine, admin panel, REST API, GraphQL layer, telemetry pipeline, CLI, and Web Components are functional and tested. Security hardening and API surface cleanup are in progress.

See the [Architecture](ARCHITECTURE.md) doc for a detailed overview of the framework design.

## Documentation

- [Getting Started](GETTING-STARTED.md)
- [Architecture](ARCHITECTURE.md)
- [CMS Guide](CMS-GUIDE.md)
- [Developer Guide](DEVELOPER-GUIDE.md)
- [Troubleshooting](TROUBLESHOOTING.md)

## Contributing

```bash
git clone https://github.com/valencets/valence.git
cd valence
pnpm install
pnpm build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for standards and the TDD workflow.

## License

MIT
