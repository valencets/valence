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

## 4. Using the Local API

The local API is for server-side code that needs direct database access without going through HTTP:

```typescript
const cms = buildCms(config)._unsafeUnwrap()

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
