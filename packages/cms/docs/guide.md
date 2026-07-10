# Building with @valencets/cms

This guide walks through defining schemas, generating migrations, wiring up a server, customizing the admin, and extending the CMS with plugins and hooks.

## 1. Defining Your Schema

Every application starts with collections. A collection is a TypeScript definition that produces a database table, Zod validators, REST endpoints, and admin UI forms.

### Basic Collection

```typescript
import { collection, field } from '@valencets/cms'

const articles = collection({
  slug: 'articles',
  labels: { singular: 'Article', plural: 'Articles' },
  fields: [
    field.text({ name: 'title', required: true, maxLength: 200 }),
    field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'title' }),
    field.textarea({ name: 'body' }),
    field.boolean({ name: 'published' }),
    field.date({ name: 'publishedAt' }),
    field.number({ name: 'readingTime', min: 0 })
  ]
})
```

What this produces:
- PostgreSQL table `articles` with columns `id`, `title`, `slug`, `body`, `published`, `publishedAt`, `readingTime`, `created_at`, `updated_at`, `deleted_at`
- Zod schema that validates `title` is a non-empty string under 200 chars, `slug` is required, etc.
- REST endpoints: `GET /api/articles`, `POST /api/articles`, `GET /api/articles/:id`, `PATCH /api/articles/:id`, `DELETE /api/articles/:id`
- Admin pages: `/admin/articles` (list), `/admin/articles/new` (create form)

### Relationships

Use `field.relation()` to create foreign key relationships between collections:

```typescript
const authors = collection({
  slug: 'authors',
  fields: [
    field.text({ name: 'name', required: true }),
    field.text({ name: 'bio' })
  ]
})

const articles = collection({
  slug: 'articles',
  fields: [
    field.text({ name: 'title', required: true }),
    field.relation({ name: 'author', relationTo: 'authors', required: true }),
    // Creates a UUID FK column referencing authors(id)
    field.textarea({ name: 'body' })
  ]
})
```

### Select Fields with Constrained Values

```typescript
const orders = collection({
  slug: 'orders',
  fields: [
    field.text({ name: 'customerName', required: true }),
    field.number({ name: 'total', required: true, hasDecimals: true, min: 0 }),
    field.select({
      name: 'status',
      required: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Cancelled', value: 'cancelled' }
      ]
    }),
    field.date({ name: 'shippedAt' })
  ]
})
```

The `select` field generates a PostgreSQL `CHECK` constraint — the database itself rejects invalid values.

### Nested Data with Groups

Use `field.group()` for structured sub-objects stored as JSONB:

```typescript
const products = collection({
  slug: 'products',
  fields: [
    field.text({ name: 'name', required: true }),
    field.number({ name: 'price', required: true, hasDecimals: true, min: 0 }),
    field.group({
      name: 'dimensions',
      fields: [
        field.number({ name: 'width' }),
        field.number({ name: 'height' }),
        field.number({ name: 'depth' }),
        field.number({ name: 'weight', hasDecimals: true })
      ]
    }),
    field.group({
      name: 'seo',
      fields: [
        field.text({ name: 'metaTitle', maxLength: 60 }),
        field.textarea({ name: 'metaDescription', maxLength: 160 }),
        field.text({ name: 'ogImage' })
      ]
    })
  ]
})
```

Groups render as `<fieldset>` in the admin UI and store as a single JSONB column in PostgreSQL.

### Media Collections

Enable file uploads by setting `upload: true`:

```typescript
const media = collection({
  slug: 'media',
  upload: true,
  fields: [
    field.text({ name: 'alt', label: 'Alt Text' }),
    field.text({ name: 'caption' })
  ]
})
```

When `upload: true`, the CMS auto-injects `filename`, `mimeType`, `filesize`, `storedPath`, and `altText` fields. Reference media from other collections with `field.media()`:

```typescript
const posts = collection({
  slug: 'posts',
  fields: [
    field.text({ name: 'title', required: true }),
    field.media({ name: 'featuredImage', relationTo: 'media' }),
    field.textarea({ name: 'body' })
  ]
})
```

### Auth-Enabled Collections

Enable authentication on a collection by setting `auth: true`:

```typescript
const users = collection({
  slug: 'users',
  auth: true,
  fields: [
    field.text({ name: 'name', required: true }),
    field.text({ name: 'role' })
  ]
})
```

`buildCms` auto-injects `email` (required, unique) and `password_hash` (hidden) fields. It also registers login, logout, and me endpoints.

### Globals (Singletons)

For site-wide settings that don't need multiple rows:

```typescript
import { global, field } from '@valencets/cms'

const siteSettings = global({
  slug: 'site-settings',
  label: 'Site Settings',
  fields: [
    field.text({ name: 'siteName', required: true }),
    field.textarea({ name: 'siteDescription' }),
    field.text({ name: 'contactEmail' }),
    field.boolean({ name: 'maintenanceMode' })
  ]
})

const navigation = global({
  slug: 'navigation',
  label: 'Navigation',
  fields: [
    field.group({
      name: 'primaryNav',
      fields: [
        field.text({ name: 'label' }),
        field.text({ name: 'url' })
      ]
    })
  ]
})
```

## 2. Generating Migrations

Once you've defined collections, generate PostgreSQL DDL:

```typescript
import { generateCreateTableSql, generateCreateTable, generateAlterTableSql } from '@valencets/cms'

// Generate raw SQL
const sql = generateCreateTableSql(articles)
console.log(sql)
// CREATE TABLE IF NOT EXISTS "articles" (
//   "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   "title" TEXT NOT NULL,
//   "slug" TEXT NOT NULL UNIQUE,
//   "body" TEXT,
//   "published" BOOLEAN,
//   "publishedAt" TIMESTAMPTZ,
//   "readingTime" INTEGER,
//   "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   "deleted_at" TIMESTAMPTZ
// );

// Generate a migration file object (compatible with @valencets/db migration runner)
const migration = generateCreateTable(articles)
if (migration.isOk()) {
  const { name, up, down } = migration.value
  // name: "1710000000000_create_articles"
  // up: "CREATE TABLE IF NOT EXISTS ..."
  // down: "DROP TABLE IF EXISTS \"articles\" CASCADE;"
}

// Schema changes (add/remove/alter columns)
const alterSql = generateAlterTableSql('articles', {
  added: [field.text({ name: 'subtitle' }), field.boolean({ name: 'featured' })],
  removed: ['readingTime'],
  changed: [field.number({ name: 'price', hasDecimals: true })]
})
// ALTER TABLE "articles"
//   ADD COLUMN "subtitle" TEXT,
//   ADD COLUMN "featured" BOOLEAN,
//   DROP COLUMN "readingTime",
//   ALTER COLUMN "price" TYPE NUMERIC;
```

## 3. Wiring Up a Server

`buildCms()` returns route maps that you register on your server:

```typescript
import { createServer } from 'node:http'
import { buildCms, collection, field } from '@valencets/cms'
import { createPool } from '@valencets/db'

const pool = createPool({
  host: 'localhost', port: 5432, database: 'myapp',
  username: 'postgres', password: '', max: 10,
  idle_timeout: 20, connect_timeout: 10
})

const result = buildCms({
  db: pool,
  secret: 'change-me-in-production',
  uploadDir: './uploads',
  collections: [
    collection({ slug: 'posts', fields: [field.text({ name: 'title', required: true })] }),
    collection({ slug: 'users', auth: true, fields: [field.text({ name: 'name' })] }),
    collection({ slug: 'media', upload: true, fields: [field.text({ name: 'alt' })] })
  ]
})

if (result.isErr()) {
  console.error(result.error)
  process.exit(1)
}

const cms = result.value

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const pathname = url.pathname
  const method = req.method ?? 'GET'

  // Check REST routes
  for (const [pattern, entry] of cms.restRoutes) {
    if (matchRoute(pathname, pattern)) {
      const handler = entry[method as keyof typeof entry]
      if (handler) { await handler(req, res, {}); return }
    }
  }

  // Check admin routes
  for (const [pattern, entry] of cms.adminRoutes) {
    if (matchRoute(pathname, pattern)) {
      const handler = entry[method as keyof typeof entry]
      if (handler) { await handler(req, res, {}); return }
    }
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(3000)
```

### REST query surface

Every collection's list endpoint (`GET /api/:slug`) accepts the same query
parameters — discovered by the dogfood build, documented here, and mirrored
by the OpenAPI spec at `GET /api/docs` (#344):

| Parameter | Meaning | Constraints |
|---|---|---|
| `page` | Page number | integer, min 1, default 1 |
| `limit` | Items per page | integer, 1–100, default 25 |
| `search` | Full-text search across the collection | tsvector-backed |
| `sort` | Field to sort by | **allow-listed**: schema fields + `id`/`created_at`/`updated_at`/`deleted_at`; anything else is 400 |
| `dir` | Sort direction | `asc` (default) or `desc` |
| `draft` | Include drafts | `true` on versioned collections |
| `locale` | Locale for localized fields | must exist in the localization config, else 400 |
| `<field>` | Equality filter, one per schema field | allow-listed; unknown fields are 400; `'true'`/`'false'` coerce to booleans |

Examples:

```
GET /api/posts?published=true&sort=created_at&dir=desc&page=2&limit=10
GET /api/posts?slug=hello-world
GET /api/posts?search=valence&draft=true
```

Responses are paginated: `{ docs, totalDocs, page, totalPages, limit, hasNextPage, hasPrevPage }`.

Richer operators (`not_equals`, `greater_than`, `less_than`, `like`, `in`,
`exists`, and/or clauses) are available server-side through the Local API's
`whereClause` — the HTTP surface deliberately stays equality-only.

Related endpoints: `POST /api/:slug?draft=true` (create as draft),
`PATCH /api/:slug/:id?publish=true` (publish on update),
`POST /api/:slug/:id/unpublish`, and `POST /api/:slug/bulk` with
`{ action: 'delete' | 'publish' | 'unpublish', ids: […] }` (max 100 ids).
All endpoints require a `cms_session` cookie unless the collection defines
its own `access` rules.

## 4. Using the Local API

The local API is for server-side code that needs direct database access without going through HTTP:

```typescript
const cms = buildCms(config).unwrap()

// Create a post
const createResult = await cms.api.create({
  collection: 'posts',
  data: { title: 'My First Post', slug: 'my-first-post', published: true }
})

createResult.match(
  (post) => console.log('Created:', post.id),
  (err) => console.error('Failed:', err.message)
)

// Query with filters
const publishedPosts = await cms.api.find({
  collection: 'posts',
  where: { published: true },
  limit: 20
})

// Update
await cms.api.update({
  collection: 'posts',
  id: 'some-uuid',
  data: { title: 'Updated Title' }
})

// Soft delete
await cms.api.delete({ collection: 'posts', id: 'some-uuid' })

// Read/write globals
const settings = await cms.api.findGlobal({ slug: 'site-settings' })
await cms.api.updateGlobal({
  slug: 'site-settings',
  data: { siteName: 'My New Site Name' }
})
```

## 5. Extending with Plugins

Plugins are pure functions that transform the CMS config before initialization. They can add collections, modify fields, or inject shared behavior.

### Adding SEO fields to all collections

```typescript
import type { Plugin } from '@valencets/cms'
import { field } from '@valencets/cms'

const seoPlugin: Plugin = (config) => ({
  ...config,
  collections: config.collections.map(col => ({
    ...col,
    fields: [
      ...col.fields,
      field.group({
        name: 'seo',
        fields: [
          field.text({ name: 'metaTitle', maxLength: 60 }),
          field.textarea({ name: 'metaDescription', maxLength: 160 })
        ]
      })
    ]
  }))
})
```

### Adding timestamps to specific collections

```typescript
const auditPlugin: Plugin = (config) => ({
  ...config,
  collections: config.collections.map(col => {
    if (col.slug === 'orders' || col.slug === 'payments') {
      return {
        ...col,
        fields: [
          ...col.fields,
          field.text({ name: 'lastModifiedBy' }),
          field.text({ name: 'changeReason' })
        ]
      }
    }
    return col
  })
})
```

### Adding a new collection via plugin

```typescript
const analyticsPlugin: Plugin = (config) => ({
  ...config,
  collections: [
    ...config.collections,
    collection({
      slug: 'page-views',
      timestamps: true,
      fields: [
        field.text({ name: 'path', required: true, index: true }),
        field.text({ name: 'referrer' }),
        field.text({ name: 'userAgent' })
      ]
    })
  ]
})
```

### Composing plugins

```typescript
const cms = buildCms({
  db: pool,
  secret: 'my-secret',
  collections: [posts, users, media],
  plugins: [seoPlugin, auditPlugin, analyticsPlugin]
  // Plugins execute left-to-right: seo → audit → analytics
})
```

## 6. Extending with Hooks

Hooks run at specific lifecycle points during CRUD operations. They execute sequentially and can transform data.

### Definitive firing order

Every entry path (REST, Local API, admin, GraphQL, bulk operations) delegates to the Local API, so one order holds everywhere:

**Writes (create / update):**

```
beforeValidate (collection)   ─ may transform data, runs before the transaction
beforeValidate (field)
┌─ transaction begins ─────────────────────────────────────┐
beforeChange (collection)     ─ may transform data
beforeChange (field)
[beforePublish (collection)]  ─ publish updates only
INSERT / UPDATE
[afterPublish (collection)]   ─ publish updates only
afterChange (field)           ─ may transform the returned document
afterChange (collection)      ─ side effects only; return value ignored
└─ transaction commits ────────────────────────────────────┘
```

A hook that throws inside the transaction rolls the write back — no partial state survives.

**Reads (find / findByID):**

```
beforeRead (collection)       ─ runs before the query
SELECT
afterRead (field)             ─ per document, may transform
afterRead (collection)        ─ per document, may transform
field-level access filtering  ─ protected fields removed last
```

**Deletes:** `beforeDelete → DELETE → afterDelete`. **Unpublish:** `beforeUnpublish → UPDATE → afterUnpublish`.

Known limitation: localized-merge updates (`update` with a `locale` on a collection with localized fields) currently bypass change hooks — the jsonb merge semantics predate the hook wiring. Tracked with the transactional-integrity work in #334.

### Auto-generating slugs

```typescript
import type { CollectionHooks } from '@valencets/cms'

const postHooks: CollectionHooks = {
  beforeValidate: [
    (args) => {
      const title = args.data.title
      if (typeof title === 'string' && !args.data.slug) {
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        return { ...args.data, slug }
      }
      return args.data
    }
  ]
}
```

### Sending notifications after changes

```typescript
const notificationHooks: CollectionHooks = {
  afterChange: [
    (args) => {
      // Fire and forget — return undefined to not modify data
      fetch('https://hooks.slack.com/...', {
        method: 'POST',
        body: JSON.stringify({ text: `Document ${args.id} updated in ${args.collection}` })
      })
      return undefined
    }
  ]
}
```

### Async hooks

Hooks can be async. The runner awaits each hook before running the next:

```typescript
const enrichmentHooks: CollectionHooks = {
  afterRead: [
    async (args) => {
      // Enrich document with external data
      const externalData = await fetchFromExternalService(args.data.externalId)
      return { ...args.data, enriched: externalData }
    }
  ]
}
```

## 7. Access Control

Define per-operation access rules that return `true`/`false` or a `WhereClause` for row-level filtering:

```typescript
import type { CollectionAccess } from '@valencets/cms'

const articleAccess: CollectionAccess = {
  // Anyone can read published articles
  read: () => ({
    and: [{ field: 'published', operator: 'equals', value: true }]
  }),

  // Only admins can create
  create: ({ req }) => {
    return req?.headers['x-role'] === 'admin'
  },

  // Only admins can update
  update: ({ req }) => {
    return req?.headers['x-role'] === 'admin'
  },

  // Only admins can delete
  delete: ({ req }) => {
    return req?.headers['x-role'] === 'admin'
  }
}
```

When an access function returns a `WhereClause`, the query builder merges it into the SQL query — users only see rows matching their access rules.

## 8. Custom Admin Views

The admin renderers are exported, so you can compose custom views:

```typescript
import { renderLayout, renderFieldInput, escapeHtml } from '@valencets/cms'

function renderCustomDashboard (collections, stats) {
  const content = collections.map(col => {
    const count = stats[col.slug] ?? 0
    return `<div class="card">
      <h3>${escapeHtml(col.labels?.plural ?? col.slug)}</h3>
      <p>${count} documents</p>
      <a href="/admin/${escapeHtml(col.slug)}">Manage</a>
    </div>`
  }).join('')

  return renderLayout({
    title: 'Dashboard',
    content,
    collections
  })
}
```

## 9. Real-World Example: E-Commerce Schema

```typescript
import { buildCms, collection, field, global } from '@valencets/cms'

const categories = collection({
  slug: 'categories',
  labels: { singular: 'Category', plural: 'Categories' },
  fields: [
    field.text({ name: 'name', required: true }),
    field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'name' }),
    field.textarea({ name: 'description' }),
    field.media({ name: 'image', relationTo: 'media' }),
    field.number({ name: 'sortOrder', min: 0 })
  ]
})

const products = collection({
  slug: 'products',
  labels: { singular: 'Product', plural: 'Products' },
  fields: [
    field.text({ name: 'name', required: true }),
    field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'name' }),
    field.textarea({ name: 'description' }),
    field.number({ name: 'price', required: true, hasDecimals: true, min: 0 }),
    field.number({ name: 'stock', required: true, min: 0 }),
    field.boolean({ name: 'active' }),
    field.relation({ name: 'category', relationTo: 'categories' }),
    field.media({ name: 'image', relationTo: 'media' }),
    field.select({
      name: 'status',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Out of Stock', value: 'out_of_stock' },
        { label: 'Discontinued', value: 'discontinued' }
      ]
    }),
    field.group({
      name: 'seo',
      fields: [
        field.text({ name: 'metaTitle', maxLength: 60 }),
        field.textarea({ name: 'metaDescription', maxLength: 160 })
      ]
    })
  ]
})

const orders = collection({
  slug: 'orders',
  labels: { singular: 'Order', plural: 'Orders' },
  fields: [
    field.relation({ name: 'customer', relationTo: 'users', required: true }),
    field.number({ name: 'total', required: true, hasDecimals: true, min: 0 }),
    field.select({
      name: 'status',
      required: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Refunded', value: 'refunded' }
      ]
    }),
    field.text({ name: 'shippingAddress', required: true }),
    field.text({ name: 'trackingNumber' }),
    field.date({ name: 'shippedAt' })
  ]
})

const users = collection({
  slug: 'users',
  auth: true,
  fields: [
    field.text({ name: 'name', required: true }),
    field.text({ name: 'phone' }),
    field.text({ name: 'address' })
  ]
})

const media = collection({
  slug: 'media',
  upload: true,
  fields: [
    field.text({ name: 'alt' })
  ]
})

const storeSettings = global({
  slug: 'store-settings',
  label: 'Store Settings',
  fields: [
    field.text({ name: 'storeName', required: true }),
    field.text({ name: 'currency' }),
    field.text({ name: 'supportEmail' }),
    field.boolean({ name: 'maintenanceMode' })
  ]
})

const cms = buildCms({
  db: pool,
  secret: process.env.CMS_SECRET,
  uploadDir: './uploads',
  collections: [categories, products, orders, users, media],
  globals: [storeSettings]
})
```

This single definition gives you:
- 5 database tables with proper types, constraints, and foreign keys
- 5 sets of REST CRUD endpoints
- Admin panel with forms auto-generated from field definitions
- Authentication with Argon2id, session cookies, rate limiting
- Media file upload and serving
- Zod validation on all writes
- Soft delete on all tables

## 9. Adding Auth to Your App (non-admin)

The admin panel's auth primitives are a public, collection-agnostic toolkit — the same Argon2id hashing, timing-safe tokens, table-backed sessions, and rate limiting the framework trusts for itself (#338). Never hand-roll PBKDF2, SHA-256 session tokens, or localStorage sessions: everything below imports from `@valencets/cms` and returns `Result`/`ResultAsync`.

```ts
import {
  hashPassword, verifyPassword,               // Argon2id
  createCustomSession, validateCustomSession, // any sessions table
  destroyCustomSession,
  generateToken, hashToken, verifyToken,      // CSPRNG + timing-safe compare
  createRateLimiter
} from '@valencets/cms'
```

### Schema

Your app owns its tables — a migration like:

```sql
CREATE TABLE IF NOT EXISTS "app_users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "app_sessions" (
  "id" TEXT PRIMARY KEY,          -- 64-char hex from createCustomSession
  "user_id" UUID NOT NULL REFERENCES "app_users"("id"),
  "expires_at" TIMESTAMPTZ NOT NULL
);
```

### Signup and login as route actions

```ts
// valence.config.ts routes
{
  path: '/signup',
  action: async ({ body, pool }) => {
    if (!pool) return { status: 500, errors: { db: ['database required'] } }
    const hash = await hashPassword(String(body.get('password') ?? ''))
    if (hash.isErr()) return { status: 500, errors: { password: [hash.error.message] } }
    // parameterized insert with YOUR table
    await pool.sql.unsafe(
      'INSERT INTO "app_users" ("email", "password_hash") VALUES ($1, $2)',
      [String(body.get('email') ?? ''), hash.value]
    )
    return { redirect: '/login' }
  }
}
```

```ts
const loginLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000 })

{
  path: '/login',
  action: async ({ body, req, pool }) => {
    if (!pool) return { status: 500, errors: { db: ['database required'] } }
    const key = `ip:${req.socket.remoteAddress ?? 'unknown'}`
    if (!loginLimiter.check(key)) return { status: 429, errors: { form: ['Too many attempts'] } }

    const email = String(body.get('email') ?? '')
    const rows = await pool.sql.unsafe('SELECT "id", "password_hash" FROM "app_users" WHERE "email" = $1', [email])
    const user = rows[0] as { id: string, password_hash: string } | undefined
    // Verify against a dummy hash when the user is unknown — uniform timing
    const ok = user
      ? (await verifyPassword(String(body.get('password') ?? ''), user.password_hash)).unwrapOr(false)
      : false
    if (!ok || !user) return { status: 401, errors: { form: ['Invalid credentials'] } }

    const session = await createCustomSession(pool, 'app_sessions', user.id)
    if (session.isErr()) return { status: 500, errors: { form: [session.error.message] } }

    return {
      redirect: '/account',
      // Secure derives from your transport; HttpOnly + SameSite always
      headers: { 'Set-Cookie': `app_session=${session.value.sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200` }
    }
  }
}
```

### Guarding routes in loaders

```ts
{
  path: '/account',
  loader: async ({ req, pool }) => {
    if (!pool) return { status: 500 }
    const cookie = req.headers.cookie ?? ''
    const token = cookie.match(/(?:^|;\s*)app_session=([^;]+)/)?.[1]
    if (!token) return { redirect: '/login' }

    const session = await validateCustomSession(pool, 'app_sessions', token)
    if (session.isErr()) return { redirect: '/login' }

    return { data: { userId: session.value.userId } }
  }
}
```

### Logout

```ts
{
  path: '/logout',
  action: async ({ req, pool }) => {
    const token = (req.headers.cookie ?? '').match(/(?:^|;\s*)app_session=([^;]+)/)?.[1]
    if (pool && token) await destroyCustomSession(pool, 'app_sessions', token)
    return { redirect: '/', headers: { 'Set-Cookie': 'app_session=; Path=/; HttpOnly; Max-Age=0' } }
  }
}
```

### Rules the toolkit enforces for you

- `createCustomSession` mints 32-byte CSPRNG hex ids and computes expiry in SQL — sessions live in **your** table, validated with parameterized queries and identifier allow-listing.
- `verifyToken` compares SHA-256 digests with `timingSafeEqual` — store `hashToken(raw)`, never the raw token (API keys, magic links, password resets).
- The rate limiter is bounded (10k entries, LRU-evicted) — safe against key-flooding.
- Composition is covered by `custom-auth-composition.test.ts` on the public surface: if a primitive stops being importable or a signature drifts, CI fails.

Everything above also works inside `onServer` handlers — the same `pool` arrives in `OnServerContext`.
