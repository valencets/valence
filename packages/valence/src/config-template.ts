export interface ConfigTemplateOptions {
  readonly dbName: string
  readonly dbUser: string
  readonly dbPassword: string
  readonly serverPort: string
  readonly learnMode: boolean
}

export function generateConfigTemplate (opts: ConfigTemplateOptions): string {
  const { dbName, dbUser, dbPassword, serverPort, learnMode } = opts

  const learnComment = (text: string) => learnMode ? `// ${text}\n    ` : ''

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
    password: process.env.DB_PASSWORD ?? '${dbPassword}'
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
  admin: {
    pathPrefix: '/admin',
    requireAuth: true
  },
  telemetry: {
    enabled: true,
    endpoint: '/api/telemetry',
    siteId: process.env.SITE_ID ?? '${dbName}'
  }
})
`
}

export function generateSecret (): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
