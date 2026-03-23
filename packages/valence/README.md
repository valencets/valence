<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/valencets/valence/master/assets/logo-dark-animated.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/valencets/valence/master/assets/logo-light-animated.png">
    <img alt="Valence" src="https://raw.githubusercontent.com/valencets/valence/master/assets/logo-light-animated.png" width="280">
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

Define collections and fields in one TypeScript config. Valence derives the database tables, admin UI, REST API, GraphQL endpoint, typed frontend scaffold, entity codegen, page routing, first-party analytics, validators, and migrations from that single schema. No plugins required. No vendor scripts. Minimal, audited dependencies.

```ts
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
        // handle form submission
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

That config gives you: `posts` and `users` tables in Postgres, a server-rendered admin panel with form validation and session auth (Argon2id), a REST API at `/api/posts` and `/api/users`, a GraphQL endpoint at `/graphql`, typed routes with loaders and actions, an `onServer` hook for custom routes and WebSocket handlers, a typed `src/` scaffold with entity interfaces and API clients, Zod validators, database migrations, draft versioning with revision history, and a first-party analytics pipeline that tracks user intent without any third-party scripts on your public pages. Change the schema, everything follows.

## Quick Start

```bash
npx @valencets/valence init my-site
cd my-site
pnpm dev
```

The init wizard walks you through:

- **Database** -- name, user, password (creates the DB and runs migrations)
- **Admin user** -- email + password for the admin panel (role set to `admin`)
- **Seed data** -- optional sample post to start with
- **Framework** -- plain HTML templates, Astro, or bring your own
- **Git** -- initializes a repo with the first commit

Init also generates a `src/` directory with Feature-Sliced Design structure, typed entity interfaces, and API clients derived from your collections. Pass `--yes` to skip prompts and accept defaults (useful for CI).

Open `http://localhost:3000/admin` to sign in. Open `http://localhost:3000` for the landing page.

## What You Get

### Schema Engine

- **Database tables** derived from your field definitions. UUID primary keys, timestamps, soft deletes.
- **22 field types**. text, textarea, richtext, number, boolean, select, date, slug, media, relation, group, email, url, password, json, color, multiselect, array, blocks, tabs, row, collapsible.
- **Layout fields**. Tabs, rows, and collapsible sections for organizing complex admin forms without affecting the database schema.
- **Conditional fields**. Show or hide fields based on other field values using the `condition` function. Re-renders via htmx partials.
- **Field access control**. Per-field `create`, `read`, and `update` access control functions that receive the current user context.
- **Field hooks**. `beforeValidate`, `beforeChange`, `afterChange`, `afterRead` hooks on individual fields for data transformation and side effects.
- **Collection hooks**. 11 lifecycle hooks: `beforeValidate`, `beforeChange`, `afterChange`, `beforeRead`, `afterRead`, `beforeDelete`, `afterDelete`, `beforePublish`, `afterPublish`, `beforeUnpublish`, `afterUnpublish`.
- **Globals**. Single-document configs (site settings, navigation, footer) via `global()` with the same field system.
- **Migrations** generated from schema diffs. Deterministic SQL, idempotent, version-tracked.

### Admin Panel

- **Server-rendered admin** at `/admin`. HTML forms, CSRF protection, session auth with Argon2id. Login page with proper error handling.
- **Rich text editor**. Tiptap-powered editor (ProseMirror) with heading, list, blockquote, link, code, divider, and code block formatting. Slash command menu for block insertion.
- **Draft versioning**. Enable `versions: { drafts: true }` on a collection for publish/unpublish workflow with revision history and diff view.
- **Autosave**. Automatic draft saving with visual indicator via the `<val-autosave>` component.
- **Live preview**. Split-pane editor with real-time preview iframe, communicating via postMessage protocol.
- **Bulk operations**. Select multiple documents in list view for bulk delete, publish, or unpublish.
- **Image processing**. Automatic image resizing and optimization via Sharp on media upload.
- **Admin headTags**. Inject custom `<link>`, `<meta>`, `<script>` tags into the admin `<head>` via config.

### API Layer

- **REST API** at `/api/:collection`. CRUD with Zod validation, parameterized queries, `Result<T, E>` error handling. Bulk endpoint at `/api/:slug/bulk`.
- **GraphQL API**. Auto-generated schema from your collections with resolvers wired to the Local API. Enable with `graphql: true` in config.
- **Local API**. Programmatic access to all CRUD operations with the same validation, hooks, and access control as the REST layer.
- **Full-text search**. PostgreSQL `tsvector`/`tsquery` with relevance ranking, configurable per collection.

### Routing

- **Page routing**. `src/pages/` maps to URL paths. List + detail page templates scaffold per collection.
- **Routes with loaders**. Define typed routes in config with `loader` functions that fetch data server-side and inject it into the page.
- **Routes with actions**. Handle form submissions with `action` functions that return redirects or field-level errors.
- **onServer hook**. Access the raw Node.js `http.Server`, database pool, CMS instance, and `registerRoute` for custom endpoints, WebSocket upgrade handlers, or middleware.
- **Typed route helpers**. Auto-generated route types with `extractParams` for type-safe URL building.
- **View transitions**. Built-in view transition presets for smooth page navigation.

### Frontend

- **23 Web Components**. ARIA-compliant, i18n-ready, telemetry hooks, hydration directives. OKLCH design tokens. Zero dependencies.
- **Component registration separation**. Component classes are defined separately from `customElements.define()` calls for tree-shaking -- import only what you use.
- **FSD scaffold**. `valence init` generates `src/` with Feature-Sliced Design: `app/`, `pages/`, `entities/`, `features/`, `shared/`.
- **Entity codegen**. Typed interfaces + API clients generated from your schema. `// @generated` files regenerate on config change; user-edited files are never overwritten.
- **Static file serving**. `public/` served with MIME types and path traversal protection.
- **Config watcher**. Edit `valence.config.ts` during dev and entity types and API clients regenerate automatically.

### Security

- **Argon2id password hashing** for admin authentication.
- **CSRF protection** on all admin forms.
- **Session auth** with `httpOnly`, `secure` cookie flags and configurable session max age.
- **Path traversal protection** on static file serving, media uploads, and cloud storage.
- **URL redirect validation** to prevent open redirect attacks.
- **Parameterized SQL** everywhere -- no string concatenation in queries.
- **CodeQL and Socket auditing** in CI.

### Plugin System

- **First-party plugins**. `@valencets/plugin-seo` (auto-title, meta field injection), `@valencets/plugin-nested-docs` (tree structures with breadcrumb computation), `@valencets/plugin-cloud-storage` (S3-compatible object storage).
- **Plugin API**. Plugins are config transformers -- a function that receives a `CmsConfig` and returns a modified `CmsConfig`. Compose with the `plugins` array.

### Analytics

- **First-party analytics**. Built-in telemetry that runs entirely in your Postgres -- no vendor scripts, no third-party dashboards, no data leaving your infrastructure.
- **Learn mode**. Interactive 6-step tutorial embedded in `valence dev` that teaches core concepts through real actions. Run `valence init --learn` to try it.

## Telemetry

Valence includes a complete, privacy-respecting analytics pipeline that runs entirely on your own infrastructure. No Google Analytics, no Plausible, no third-party scripts on your public pages. Your data stays in your Postgres.

**How it works:**

1. Annotate HTML elements with `data-telemetry-*` attributes:
   ```html
   <button data-telemetry-type="CLICK" data-telemetry-target="hero.cta">
     Get Started
   </button>
   ```

2. The client library captures user intent events in a **pre-allocated ring buffer** (zero allocation in the hot path) and auto-flushes via `navigator.sendBeacon()` every 30 seconds.

3. The server ingests beacon payloads, stores raw events, and aggregates them into **daily summaries** -- sessions, pageviews, conversions, top pages, top referrers, device breakdowns.

4. View it all in the built-in **analytics dashboard** at `/admin/analytics`.

**11 intent types** beyond simple pageviews: `CLICK`, `SCROLL`, `VIEWPORT_INTERSECT`, `FORM_INPUT`, `INTENT_NAVIGATE`, `INTENT_CALL`, `INTENT_BOOK`, `INTENT_LEAD`, `LEAD_PHONE`, `LEAD_EMAIL`, `LEAD_FORM`. This means you can track conversion-oriented actions (calls, bookings, form submissions) natively, not just clicks.

**Architecture:** The telemetry pipeline spans two packages. `@valencets/core` handles client-side capture (ring buffer, event delegation, beacon flush). `@valencets/telemetry` handles server-side ingestion, validation, daily aggregation, and query functions (`getDailyTrend`, `getDailyBreakdowns`). The CMS admin panel consumes these queries to render the dashboard.

## Packages

| Package | What it does | External deps |
|---------|-------------|---------------|
| **@valencets/ui** | 23 Web Components. ARIA, i18n, telemetry hooks, hydration directives. OKLCH design tokens. | none |
| **@valencets/core** | Router + server. `pushState` nav, fragment swaps, prefetch, view transitions, server islands. | [@valencets/resultkit](https://www.npmjs.com/package/@valencets/resultkit) |
| **@valencets/db** | PostgreSQL query layer. Tagged template SQL, parameterized queries, `Result<T,E>`, migration runner. | [postgres](https://github.com/porsager/postgres), [@valencets/resultkit](https://www.npmjs.com/package/@valencets/resultkit), [zod](https://github.com/colinhacks/zod) |
| **@valencets/cms** | Schema engine. `collection()` + `field.*` produces tables, validators, REST API, admin UI, auth, media, image processing. Rich text via Tiptap (ProseMirror). | [tiptap](https://tiptap.dev), [argon2](https://github.com/ranisalt/node-argon2), [sharp](https://github.com/lovell/sharp), [zod](https://github.com/colinhacks/zod), [@valencets/resultkit](https://www.npmjs.com/package/@valencets/resultkit) |
| **@valencets/graphql** | Auto-generated GraphQL schema + resolvers from CMS collections. | [graphql](https://github.com/graphql/graphql-js), [@valencets/resultkit](https://www.npmjs.com/package/@valencets/resultkit) |
| **@valencets/telemetry** | Beacon ingestion, event storage, daily summaries, fleet aggregation. | [postgres](https://github.com/porsager/postgres), [@valencets/resultkit](https://www.npmjs.com/package/@valencets/resultkit) |
| **@valencets/valence** | CLI + FSD scaffold + entity codegen + route types. `valence init`, `valence dev`, `valence migrate`, `valence build`. | [tsx](https://github.com/privatenumber/tsx), [zod](https://github.com/colinhacks/zod), [@valencets/resultkit](https://www.npmjs.com/package/@valencets/resultkit) |
| **@valencets/plugin-seo** | SEO field injection and auto-title hook. | none (peer dep on cms) |
| **@valencets/plugin-nested-docs** | Tree structures with breadcrumb computation. | none (peer dep on cms) |
| **@valencets/plugin-cloud-storage** | S3-compatible media storage adapter. | [@aws-sdk/client-s3](https://github.com/aws/aws-sdk-js-v3), [@valencets/resultkit](https://www.npmjs.com/package/@valencets/resultkit) |

**Core external runtime deps:** 8 -- postgres, @valencets/resultkit, zod, tiptap, argon2, sharp, graphql, tsx. All MIT-licensed, all audited via [Socket](https://socket.dev/npm/package/@valencets/valence).

**Browser JS:** Public-facing pages ship zero third-party JavaScript. The admin panel uses [Tiptap](https://tiptap.dev/) (ProseMirror, MIT) for rich text editing only.

## Non-Negotiable

| Rule | Why |
|------|-----|
| Complexity < 20 | Every function fits on one screen. No exceptions. |
| `Result<T, E>` everywhere | If it can fail, the type signature says so. Both branches handled or it doesn't compile. |
| 14kB critical shell | First paint in the first TCP data flight. CDN-ready with cache profiles and server islands. |
| Pre-allocated ring buffer | Zero allocation in the telemetry hot path. |
| Zero third-party JS on public pages | Your site ships your code. Tiptap is admin-only. Nothing phones home. |
| 3,022 tests | Strict TypeScript, neostandard, CI on every push. |

## Documentation

- [Getting Started](https://github.com/valencets/valence/wiki/Getting-Started)
- [Architecture](https://github.com/valencets/valence/wiki/Architecture)
- [CMS Guide](https://github.com/valencets/valence/wiki/CMS-Guide)
- [Developer Guide](https://github.com/valencets/valence/wiki/Developer-Guide)
- [Troubleshooting](https://github.com/valencets/valence/wiki/Troubleshooting)

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
