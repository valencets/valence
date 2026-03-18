# @valencets/cms

Schema-driven CMS for Valence. Define a schema, get a database, admin interface, REST API, validation, auth, and media uploads out of the box.

## Quick Start

```typescript
import { buildCms, collection, field, global } from '@valencets/cms'
import { createPool } from '@valencets/db'

const pool = createPool({ host: 'localhost', port: 5432, database: 'myapp', username: 'postgres', password: '', max: 10, idle_timeout: 20, connect_timeout: 10 })

const result = buildCms({
  db: pool,
  secret: process.env.CMS_SECRET,
  uploadDir: './uploads',
  collections: [
    collection({
      slug: 'posts',
      labels: { singular: 'Post', plural: 'Posts' },
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true, unique: true }),
        field.textarea({ name: 'body' }),
        field.boolean({ name: 'published' }),
        field.select({
          name: 'status',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' }
          ]
        }),
        field.date({ name: 'publishedAt' }),
        field.relation({ name: 'author', relationTo: 'users' }),
        field.group({
          name: 'seo',
          fields: [
            field.text({ name: 'metaTitle' }),
            field.textarea({ name: 'metaDescription' })
          ]
        })
      ]
    }),

    collection({
      slug: 'users',
      auth: true,
      fields: [
        field.text({ name: 'name', required: true })
      ]
    }),

    collection({
      slug: 'media',
      upload: true,
      fields: [
        field.text({ name: 'alt' })
      ]
    })
  ],
  globals: [
    global({
      slug: 'site-settings',
      label: 'Site Settings',
      fields: [
        field.text({ name: 'siteName', required: true }),
        field.textarea({ name: 'siteDescription' })
      ]
    })
  ]
})

if (result.isErr()) {
  console.error('CMS init failed:', result.error.message)
  process.exit(1)
}

const cms = result.value
// cms.api        — Local API (find, create, update, delete)
// cms.restRoutes — Auto-generated REST endpoints
// cms.adminRoutes — Server-rendered admin panel
// cms.collections — Collection registry
// cms.globals     — Global registry
```

## Schema

### Collections

Collections are database-backed document types. Each collection gets a PostgreSQL table, Zod validation, REST endpoints, and admin UI.

```typescript
import { collection, field } from '@valencets/cms'

const pages = collection({
  slug: 'pages',                              // Table name, URL path segment
  labels: { singular: 'Page', plural: 'Pages' }, // Admin UI labels (optional)
  timestamps: true,                           // created_at, updated_at (default true)
  auth: false,                                // Enable auth (auto-adds email, password_hash)
  upload: false,                              // Enable media uploads (auto-adds file fields)
  fields: [/* ... */]
})
```

### Field Types (v0.1)

| Factory | PG Type | Zod Type | Options |
|---------|---------|----------|---------|
| `field.text()` | `TEXT` | `z.string()` | `minLength`, `maxLength` |
| `field.textarea()` | `TEXT` | `z.string()` | `minLength`, `maxLength` |
| `field.number()` | `INTEGER`/`NUMERIC` | `z.number()` | `min`, `max`, `hasDecimals` |
| `field.boolean()` | `BOOLEAN` | `z.boolean()` | — |
| `field.select()` | `TEXT` + CHECK | `z.enum()` | `options: [{label, value}]`, `hasMany` |
| `field.date()` | `TIMESTAMPTZ` | `z.string()` | — |
| `field.slug()` | `TEXT` | `z.string()` | `slugFrom` (auto-generate from field) |
| `field.media()` | `UUID` FK | `z.string().uuid()` | `relationTo` |
| `field.relation()` | `UUID` FK | `z.string().uuid()` | `relationTo`, `hasMany` |
| `field.group()` | `JSONB` | nested object | `fields: [...]` |

All fields share base options: `name` (required), `required`, `unique`, `index`, `defaultValue`, `hidden`, `localized`, `label`.

### Globals

Singleton documents (site settings, navigation, footer). One row per global.

```typescript
import { global, field } from '@valencets/cms'

const siteSettings = global({
  slug: 'site-settings',
  label: 'Site Settings',
  fields: [
    field.text({ name: 'siteName', required: true }),
    field.textarea({ name: 'siteDescription' })
  ]
})
```

### Type Inference

Extract TypeScript types from field definitions at the type level:

```typescript
import type { InferFieldsType } from '@valencets/cms'

const postFields = [
  field.text({ name: 'title' }),
  field.number({ name: 'order' }),
  field.boolean({ name: 'active' })
] as const

type Post = InferFieldsType<typeof postFields>
// { title: string, order: number, active: boolean }
```

## Local API

Direct function calls for server-side operations. All methods return `ResultAsync<T, CmsError>`.

```typescript
const cms = buildCms(config)._unsafeUnwrap()
const api = cms.api

// Find all
const posts = await api.find({ collection: 'posts' })

// Find with filters
const published = await api.find({
  collection: 'posts',
  where: { published: true },
  limit: 10
})

// Find by ID
const post = await api.findByID({ collection: 'posts', id: 'uuid-here' })

// Create
const newPost = await api.create({
  collection: 'posts',
  data: { title: 'Hello', slug: 'hello' }
})

// Update
const updated = await api.update({
  collection: 'posts',
  id: 'uuid-here',
  data: { title: 'Updated' }
})

// Delete (soft delete)
const deleted = await api.delete({ collection: 'posts', id: 'uuid-here' })

// Count
const count = await api.count({ collection: 'posts' })

// Globals
const settings = await api.findGlobal({ slug: 'site-settings' })
const updatedSettings = await api.updateGlobal({
  slug: 'site-settings',
  data: { siteName: 'New Name' }
})
```

## REST API

Auto-generated JSON endpoints per collection. Requires `Content-Type: application/json` on mutating requests.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/:collection` | List documents |
| `POST` | `/api/:collection` | Create document (Zod validated) |
| `GET` | `/api/:collection/:id` | Get document by ID |
| `PATCH` | `/api/:collection/:id` | Update document (Zod validated) |
| `DELETE` | `/api/:collection/:id` | Soft delete document |

### Auth Endpoints (when `auth: true` collection exists)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/users/login` | Login (email + password, Zod validated) |
| `POST` | `/api/users/logout` | Logout (clears session cookie) |
| `GET` | `/api/users/me` | Current user (requires session) |

### Media Endpoints (when `uploadDir` configured with `upload: true` collection)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/media/upload` | Upload file (raw body, `X-Filename` header) |
| `GET` | `/media/:filename` | Serve uploaded file |

## Admin Panel

Server-rendered HTML admin interface. Auto-generated from registered collections.

- `/admin` — Dashboard with collection cards
- `/admin/:collection` — Document list with table
- `/admin/:collection/new` — Create form (CSRF protected, Zod validated)
- `/admin/:collection/:id/edit` — Edit form

### Auth Protection

```typescript
const routes = createAdminRoutes(pool, collections, { requireAuth: true })
// All admin routes return 401 without valid session cookie
```

## Query Builder

Chainable query API wrapping PostgreSQL's parameterized queries via `sql.unsafe()`.

```typescript
const qb = createQueryBuilder(pool, registry)

// Chain operations
const result = await qb.query('posts')
  .where('published', 'equals', true)
  .where('status', 'not_equals', 'draft')
  .orderBy('created_at', 'desc')
  .limit(10)
  .all()

// Pagination
const page = await qb.query('posts')
  .where('published', true)
  .page(1, 10)
// Returns { docs, totalDocs, page, totalPages, limit, hasNextPage, hasPrevPage }

// Shorthand where (defaults to equals)
qb.query('posts').where('slug', 'hello-world').first()

// Include soft-deleted rows
qb.query('posts').withDeleted().all()
```

### Where Operators

`equals`, `not_equals`, `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal`, `like`, `in`, `exists`

## Migrations

Generate PostgreSQL DDL from collection schemas.

```typescript
import { generateCreateTableSql, generateAlterTableSql, generateCreateTable } from '@valencets/cms'

// Generate CREATE TABLE
const sql = generateCreateTableSql(postsCollection)
// CREATE TABLE IF NOT EXISTS "posts" (
//   "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   "title" TEXT NOT NULL,
//   "slug" TEXT NOT NULL UNIQUE,
//   ...
//   "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   "deleted_at" TIMESTAMPTZ
// );

// Generate ALTER TABLE for schema changes
const alterSql = generateAlterTableSql('posts', {
  added: [field.text({ name: 'subtitle' })],
  removed: ['old_field'],
  changed: [field.number({ name: 'price', hasDecimals: true })]
})

// Generate migration file (with name + up/down)
const migration = generateCreateTable(postsCollection)
// Returns Result<{ name: '1234_create_posts', up: 'CREATE TABLE...', down: 'DROP TABLE...' }, CmsError>
```

## Auth

Argon2id password hashing. Session-based authentication with secure cookie flags.

```typescript
import { hashPassword, verifyPassword, createSession, validateSession } from '@valencets/cms'

// Hash password
const hash = await hashPassword('my-password')
// Returns ResultAsync<string, CmsError>

// Verify password
const valid = await verifyPassword('my-password', hash)
// Returns ResultAsync<boolean, CmsError>

// Session management
const sessionId = await createSession(userId, pool)
const userId = await validateSession(sessionId, pool)
await destroySession(sessionId, pool)
```

### Session Cookies

- `HttpOnly` — not accessible to JavaScript
- `SameSite=Strict` — not sent on cross-site requests
- `Secure` — HTTPS only
- `Max-Age=7200` — 2 hour expiration

### Rate Limiting

Login endpoint rate-limited to 5 attempts per email per 15 minutes. Returns `429 Too Many Requests` when exceeded.

### CSRF Protection

Admin form POST handlers are protected with one-time CSRF tokens:
- GET renders a hidden `_csrf` field in the form
- POST validates the token (constant-time comparison)
- Tokens expire after 1 hour
- Each token is consumed on use

## Access Control

Per-collection, per-operation access functions returning `boolean` or `WhereClause` for row-level security.

```typescript
import { collection, field } from '@valencets/cms'
import type { CollectionAccess } from '@valencets/cms'

const access: CollectionAccess = {
  create: ({ req }) => req?.headers['x-role'] === 'admin',
  read: () => ({ and: [{ field: 'published', operator: 'equals', value: true }] }),
  update: ({ req }) => req?.headers['x-role'] === 'admin',
  delete: ({ req }) => req?.headers['x-role'] === 'admin'
}
```

## Hooks

Lifecycle hooks for collections. Hooks execute sequentially. Return data to transform it through the chain, or `undefined` to pass through.

```typescript
import type { CollectionHooks } from '@valencets/cms'

const hooks: CollectionHooks = {
  beforeValidate: [(args) => ({ ...args.data, slug: slugify(args.data.title) })],
  beforeChange: [],
  afterChange: [(args) => { notifyWebhook(args.data); return undefined }],
  beforeRead: [],
  afterRead: [],
  beforeDelete: [],
  afterDelete: []
}
```

## Plugins

Pure functional config transformers. Plugins receive the CMS config and return a modified version.

```typescript
import type { Plugin } from '@valencets/cms'

const seoPlugin: Plugin = (config) => ({
  ...config,
  collections: config.collections.map(col => ({
    ...col,
    fields: [
      ...col.fields,
      field.group({
        name: 'seo',
        fields: [
          field.text({ name: 'metaTitle' }),
          field.textarea({ name: 'metaDescription' })
        ]
      })
    ]
  }))
})

const cms = buildCms({
  ...config,
  plugins: [seoPlugin]
})
```

## Validation

Zod schemas generated from field definitions. `.safeParse()` only — never `.parse()`.

```typescript
import { generateZodSchema, generatePartialSchema } from '@valencets/cms'

const schema = generateZodSchema(postsCollection.fields)
const result = schema.safeParse({ title: 'Hello', slug: 'hello' })

if (!result.success) {
  console.log(result.error.issues)
}

// Partial schema for updates (all fields optional, types still validated)
const partialSchema = generatePartialSchema(postsCollection.fields)
partialSchema.safeParse({ title: 'Updated' }) // OK, slug not required
```

## Error Handling

All operations return `Result<T, CmsError>` or `ResultAsync<T, CmsError>`. No exceptions.

```typescript
import { CmsErrorCode } from '@valencets/cms'

const result = await api.findByID({ collection: 'posts', id: 'missing' })
result.match(
  (doc) => console.log('Found:', doc),
  (err) => {
    // err.code is one of:
    // NOT_FOUND, INVALID_INPUT, VALIDATION_FAILED,
    // DUPLICATE_SLUG, UNAUTHORIZED, FORBIDDEN, INTERNAL
    console.error(err.code, err.message)
  }
)
```

## Security

- **SQL injection** — All queries use parameterized values via `sql.unsafe()`. Identifiers validated against `[a-zA-Z][a-zA-Z0-9_-]*` regex and checked against collection schema before interpolation.
- **XSS** — All HTML output uses `escapeHtml()` (escapes `& < > " '`). No raw interpolation.
- **CSRF** — One-time tokens with constant-time validation and 1-hour TTL on admin forms. REST API requires `Content-Type: application/json`.
- **Path traversal** — Media filenames validated against `[a-zA-Z0-9][a-zA-Z0-9._-]*`, resolved paths checked with `startsWith(uploadDir)`.
- **Auth** — Argon2id hashing, `HttpOnly; SameSite=Strict; Secure` cookies, rate limiting on login.
- **Input validation** — Zod schemas enforced on REST POST/PATCH and admin form POST.

## Module Map

```
packages/cms/src/
├── schema/          # collection(), global(), field.*, registry, type inference
├── validation/      # Zod schema generator, slug/email validators
├── db/              # Query builder, migration generator, SQL sanitization
├── access/          # Access control types and resolver
├── hooks/           # Lifecycle hook types and runner
├── auth/            # Password hashing, sessions, middleware, CSRF, rate limiting
├── api/             # Local API, REST API, HTTP utilities
├── admin/           # Server-rendered admin panel (layout, views, field renderers)
├── media/           # Upload/serve handlers, MIME detection
├── config/          # buildCms() entry point, plugin system
└── index.ts         # Package barrel export
```

## Testing

270 tests across 34 test files.

```bash
pnpm --filter=cms test
```
