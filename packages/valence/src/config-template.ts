import { randomBytes } from 'node:crypto'

export interface ConfigTemplateOptions {
  readonly dbName: string
  readonly dbUser: string
  readonly dbPassword: string
  readonly serverPort: string
  readonly learnMode: boolean
  /** Omit the admin section for headless CMS projects. Defaults true. */
  readonly includeAdmin?: boolean
}

export function generateConfigTemplate (opts: ConfigTemplateOptions): string {
  const { dbName, dbUser, dbPassword, serverPort, learnMode } = opts
  const includeAdmin = opts.includeAdmin ?? true

  const learnComment = (text: string) => learnMode ? `// ${text}\n    ` : ''
  const dbSslModeExpression = `process.env.DB_SSLMODE === 'disable' ||
    process.env.DB_SSLMODE === 'require' ||
    process.env.DB_SSLMODE === 'verify-ca' ||
    process.env.DB_SSLMODE === 'verify-full'
      ? process.env.DB_SSLMODE
      : undefined`

  const tagsCollection = learnMode
    ? `,

    // ── LEARN MODE: Step 4 ──────────────────────────────────────
    // Uncomment the collection below and save this file.
    // Valence will detect the change automatically!
    //
    // collection({
    //   slug: 'tags',
    //   labels: { singular: 'Tag', plural: 'Tags' },
    //   fields: [
    //     field.text({ name: 'name', required: true }),
    //     field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'name' })
    //   ]
    // })`
    : ''

  return `import { defineConfig, collection, field } from '@valencets/valence'
${learnMode ? '\n// This config defines your collections (data models), database connection,\n// and server settings. Each collection becomes a database table, an admin UI,\n// and a REST API endpoint automatically.\n' : ''}
export default defineConfig({
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? '${dbName}',
    username: process.env.DB_USER ?? '${dbUser}',
    password: process.env.DB_PASSWORD ?? '${dbPassword}',
    sslmode: ${dbSslModeExpression},
    sslrootcert: process.env.DB_SSLROOTCERT
  },
  server: {
    port: Number(process.env.PORT ?? ${serverPort})
  },
  collections: [
    ${learnComment('Posts: uses richtext for the body and a boolean toggle for publish status.')}collection({
      slug: 'posts',
      labels: { singular: 'Post', plural: 'Posts' },
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'title' }),
        field.richtext({ name: 'body' }),
        field.boolean({ name: 'published' }),
        field.date({ name: 'publishedAt' })
      ]
    }),

    ${learnComment('Users: auth: true enables password hashing and session management.')}collection({
      slug: 'users',
      auth: true,
      fields: [
        field.text({ name: 'name', required: true }),
        field.select({
          name: 'role',
          defaultValue: 'editor',
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'Editor', value: 'editor' }
          ]
        })
      ]
    })${tagsCollection}
  ],
${includeAdmin
    ? `  admin: {
    pathPrefix: '/admin',
    requireAuth: true
  },
`
    : ''}  telemetry: {
    enabled: true,
    endpoint: '/api/telemetry',
    siteId: process.env.SITE_ID ?? '${dbName}'
  }
})
`
}

/**
 * The CMS-less scaffold: a Valence app is routes + pages by default.
 * No database, no collections, no admin — add them later by extending
 * this config; every capability is derived from what the config declares.
 */
export function generateMinimalConfigTemplate (serverPort: string): string {
  return `import { defineConfig } from '@valencets/valence'

// A Valence app is routes + pages by default. Everything else is opt-in:
// add \`collections\` (with a \`db\` section or DB_* env vars) for the CMS,
// \`admin\` for the panel, \`stores\` for live shared state, \`telemetry\`
// for first-party analytics — the server derives what to mount from what
// this file declares.
export default defineConfig({
  server: {
    port: Number(process.env.PORT ?? ${serverPort})
  },
  routes: [
    {
      path: '/api/hello/:name',
      loader: async ({ params }) => ({
        data: { greeting: \`Hello, \${params.name}!\` }
      })
    }
  ]
})
`
}

/**
 * Mint a CMS_SECRET for the scaffolded .env — 32 bytes of CSPRNG output as
 * 64 hex chars. Math.random is banned here: the secret keys the HMAC that
 * signs anonymous store sessions, so it must be unpredictable.
 */
export function generateSecret (): string {
  return randomBytes(32).toString('hex')
}
