import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { execSync, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { createPool, closePool, loadMigrations, runMigrations } from '@valencets/db'
import type { DbConfig } from '@valencets/db'
import { buildCms } from '@valencets/cms'
import type { RestRouteEntry } from '@valencets/cms'
import { readLearnProgress, writeLearnProgress, createInitialProgress } from './learn/index.js'

const COMMANDS = {
  init: 'Create a new Valence project',
  dev: 'Start the development server',
  migrate: 'Run pending database migrations',
  build: 'Build the project for production',
  'user:create': 'Create an admin user',
  learn: 'Manage learn mode tutorial'
} as const

type Command = keyof typeof COMMANDS

const commandMap: Record<Command, (args: ReadonlyArray<string>) => Promise<void>> = {
  init: runInit,
  dev: runDev,
  migrate: runMigrate,
  build: runBuild,
  'user:create': runUserCreate,
  learn: runLearn
}

export async function run (argv: ReadonlyArray<string>): Promise<void> {
  const command = argv[0] as Command | undefined

  if (command === undefined || !(command in commandMap)) {
    printUsage()
    return
  }

  await commandMap[command](argv.slice(1))
}

function printUsage (): void {
  console.log('\n  Usage: valence <command>\n')
  console.log('  Commands:')
  for (const [name, desc] of Object.entries(COMMANDS)) {
    console.log(`    ${name.padEnd(14)} ${desc}`)
  }
  console.log()
}

// -- Prompt helpers --

async function ask (rl: ReturnType<typeof createInterface>, question: string, fallback: string): Promise<string> {
  const answer = await rl.question(`  ${question} (${fallback}): `)
  return answer.trim() || fallback
}

async function confirm (rl: ReturnType<typeof createInterface>, question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N'
  const answer = await rl.question(`  ${question} (${hint}): `)
  const normalized = answer.trim().toLowerCase()
  if (normalized === '') return defaultYes
  return normalized === 'y' || normalized === 'yes'
}

function exec (cmd: string, cwd: string): boolean {
  try {
    execSync(cmd, { cwd, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function log (msg: string): void {
  console.log(`  ${msg}`)
}

// -- init --

// eslint-disable-next-line complexity
async function runInit (args: ReadonlyArray<string>): Promise<void> {
  const nonFlagArgs = args.filter(a => !a.startsWith('--'))
  const useDefaults = args.includes('--yes') || args.includes('-y')
  const learnMode = args.includes('--learn')

  console.log('\n  Welcome to Valence.\n')

  const rl = useDefaults ? null : createInterface({ input: stdin, output: stdout })

  const projectName = useDefaults ? (nonFlagArgs[0] ?? 'my-valence-app') : await ask(rl!, 'Project name', nonFlagArgs[0] ?? 'my-valence-app')
  const dbName = useDefaults ? projectName.replace(/[^a-z0-9_]/g, '_') : await ask(rl!, 'Database name', projectName.replace(/[^a-z0-9_]/g, '_'))
  const dbUser = useDefaults ? 'postgres' : await ask(rl!, 'Database user', 'postgres')
  const dbPassword = useDefaults ? '' : await ask(rl!, 'Database password', '')
  const serverPort = useDefaults ? '3000' : await ask(rl!, 'Server port', '3000')

  if (!useDefaults) {
    console.log()
    log('Frontend framework:')
    log('  1. None (plain HTML templates)')
    log('  2. Astro (recommended for static + islands)')
    log('  3. Bring your own')
  }
  const frameworkChoice = useDefaults ? '1' : await ask(rl!, 'Choose', '1')

  const installDeps = useDefaults ? true : await confirm(rl!, 'Install dependencies?')
  const createDb = useDefaults ? true : await confirm(rl!, `Create database "${dbName}"?`)
  const doMigrate = useDefaults ? true : await confirm(rl!, 'Run initial migrations?')
  const doSeed = useDefaults ? true : await confirm(rl!, 'Insert sample seed data?')
  const initGit = useDefaults ? true : await confirm(rl!, 'Initialize git repository?')

  if (rl) rl.close()

  const dir = join(process.cwd(), projectName)
  console.log()
  log(`Creating ${projectName}...`)

  await mkdir(dir, { recursive: true })
  await mkdir(join(dir, 'collections'), { recursive: true })
  await mkdir(join(dir, 'migrations'), { recursive: true })
  await mkdir(join(dir, 'public'), { recursive: true })
  await mkdir(join(dir, 'templates'), { recursive: true })
  await mkdir(join(dir, 'uploads'), { recursive: true })

  const extraDeps: Record<string, string> = {}
  const frameworkMap: Record<string, string> = { 2: 'astro' }
  const framework = frameworkMap[frameworkChoice]
  if (framework === 'astro') {
    extraDeps.astro = '^5.0.0'
  }

  await writeFile(join(dir, 'package.json'), JSON.stringify({
    name: projectName,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'valence dev',
      build: 'valence build',
      migrate: 'valence migrate',
      'user:create': 'valence user:create',
      start: 'node dist/server.js'
    },
    dependencies: {
      '@valencets/valence': '^0.5.0',
      '@valencets/cms': '^0.1.0',
      '@valencets/db': '^0.1.1',
      tsx: '^4.21.0',
      ...extraDeps
    },
    devDependencies: {
      typescript: '^5.9.3'
    }
  }, null, 2) + '\n')

  await writeFile(join(dir, 'valence.config.ts'), generateConfigTemplate({ dbName, dbUser, dbPassword, serverPort, learnMode }))

  await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      noImplicitAny: true,
      noImplicitReturns: true,
      strictNullChecks: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      outDir: 'dist',
      rootDir: '.',
      declaration: true,
      sourceMap: true
    },
    include: ['*.ts', 'collections/**/*.ts']
  }, null, 2) + '\n')

  const envContent = `DB_HOST=localhost
DB_PORT=5432
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
PORT=${serverPort}
CMS_SECRET=${generateSecret()}
`
  await writeFile(join(dir, '.env'), envContent)
  await writeFile(join(dir, '.env.example'), envContent.replace(dbPassword, '').replace(/CMS_SECRET=.*/, 'CMS_SECRET=change-me'))

  const gitignoreLines = ['node_modules/', 'dist/', '.env', 'uploads/', '*.log']
  if (learnMode) gitignoreLines.push('.valence/')
  await writeFile(join(dir, '.gitignore'), gitignoreLines.join('\n') + '\n')

  await writeFile(join(dir, 'README.md'), `# ${projectName}

Built with [Valence](https://valence.build).

## Development

\`\`\`bash
pnpm dev
\`\`\`

Site: http://localhost:${serverPort}
Admin: http://localhost:${serverPort}/admin
`)

  await writeFile(join(dir, 'migrations', '001-init.sql'), `CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "categories" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "color" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "body" TEXT,
  "category" UUID REFERENCES "categories"("id"),
  "published" BOOLEAN DEFAULT false,
  "publishedAt" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "pages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "content" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "publishedAt" TIMESTAMPTZ,
  "seo" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'editor',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

-- Telemetry tables
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "sessions" (
  "session_id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "referrer" TEXT,
  "device_type" VARCHAR(50) NOT NULL DEFAULT 'desktop',
  "operating_system" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "events" (
  "event_id" BIGSERIAL PRIMARY KEY,
  "session_id" UUID NOT NULL REFERENCES "sessions"("session_id") ON DELETE RESTRICT,
  "event_category" VARCHAR(100) NOT NULL,
  "dom_target" TEXT,
  "payload" JSONB DEFAULT '{}',
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_session ON "events"("session_id");
CREATE INDEX IF NOT EXISTS idx_events_time_category ON "events"("created_at", "event_category");

CREATE TABLE IF NOT EXISTS "daily_summaries" (
  "id" SERIAL PRIMARY KEY,
  "site_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "business_type" TEXT,
  "schema_version" INT DEFAULT 1,
  "session_count" INT,
  "pageview_count" INT,
  "conversion_count" INT,
  "top_referrers" JSONB DEFAULT '[]',
  "top_pages" JSONB DEFAULT '[]',
  "intent_counts" JSONB DEFAULT '{}',
  "avg_flush_ms" FLOAT DEFAULT 0,
  "rejection_count" INT DEFAULT 0,
  "synced_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("site_id", "date")
);
`)

  log('Project scaffolded.')

  if (learnMode) {
    const { ensureLearnDir } = await import('./learn/index.js')
    await ensureLearnDir(dir)
    const learnProgress = createInitialProgress({ posts: 0, users: 0 })
    await writeLearnProgress(dir, learnProgress)
    log('Learn mode enabled.')
  }

  if (installDeps) {
    log('Installing dependencies...')
    const pm = detectPackageManager()
    if (!exec(`${pm} install`, dir)) {
      log('Warning: dependency install failed. Run it manually.')
    } else {
      log('Dependencies installed.')
    }
  }

  if (createDb) {
    log(`Creating database "${dbName}"...`)
    if (exec(`createdb ${dbName}`, dir)) {
      log('Database created.')
    } else {
      log('Warning: could not create database. It may already exist or createdb is not in PATH.')
    }
  }

  if (doMigrate) {
    log('Running migrations...')
    const migrated = await runMigrationsForProject(dir, {
      host: 'localhost',
      port: 5432,
      database: dbName,
      username: dbUser,
      password: dbPassword,
      max: 5,
      idle_timeout: 10,
      connect_timeout: 10
    })
    if (migrated) {
      log('Migrations applied.')
      if (doSeed) {
        log('Seeding initial data...')
        try {
          const seedPool = createPool({
            host: 'localhost',
            port: 5432,
            database: dbName,
            username: dbUser,
            password: dbPassword,
            max: 5,
            idle_timeout: 10,
            connect_timeout: 10
          })
          await seedDatabase(seedPool as never)
          await closePool(seedPool)
          log('Seed data inserted.')
        } catch {
          log('Warning: seed data insertion failed. The database may already have data.')
        }
      }
    } else {
      log('Warning: migrations failed. Run "valence migrate" after fixing your database connection.')
    }
  }

  if (initGit) {
    if (exec('git init', dir) && exec('git add -A', dir) && exec('git commit -m "Initial commit from valence init"', dir)) {
      log('Git repository initialized.')
    }
  }

  const learnUrl = learnMode ? `\n  Tutorial: http://localhost:${serverPort}/_learn` : ''
  console.log(`
  Done. Your project is ready.

    cd ${projectName}
    pnpm dev

  Site:  http://localhost:${serverPort}
  Admin: http://localhost:${serverPort}/admin${learnUrl}
`)
}

// -- dev --

async function runDev (): Promise<void> {
  const config = loadEnvConfig()
  if (!config) {
    console.error('  Error: missing .env or database configuration. Run from your project root.')
    process.exit(1)
  }

  const port = Number(process.env.PORT ?? 3000)
  const projectDir = process.cwd()

  log('Running migrations...')
  await runMigrationsForProject(projectDir, config)

  log('Loading config...')
  const userConfig = await loadUserConfig()
  if (!userConfig) {
    console.error('  Error: could not load valence.config.ts. Make sure it exists and exports defineConfig().')
    process.exit(1)
  }

  log('Building CMS...')
  const pool = createPool(config)

  const cmsResult = buildCms({
    db: pool,
    secret: process.env.CMS_SECRET ?? 'dev-secret',
    uploadDir: join(projectDir, 'uploads'),
    collections: userConfig,
    telemetryPool: pool
  })

  if (cmsResult.isErr()) {
    console.error('  CMS build failed:', cmsResult.error.message)
    process.exit(1)
  }

  const cms = cmsResult.value

  // Learn mode setup
  const learnProgress = await readLearnProgress(projectDir)
  const learnActive = learnProgress !== null && learnProgress.enabled

  let learnSignals: import('./learn/types.js').LearnSignals | null = null
  let currentConfigSlugs: ReadonlyArray<string> = userConfig.map(c => c.slug)
  let currentLearnProgress = learnProgress
  let configWatcher: import('node:fs').FSWatcher | null = null

  if (learnActive) {
    const { createLearnSignals, startConfigWatcher } = await import('./learn/index.js')
    learnSignals = createLearnSignals()

    const configPath = join(projectDir, 'valence.config.ts')
    if (existsSync(configPath)) {
      const { markConfigChanged } = await import('./learn/index.js')
      configWatcher = startConfigWatcher({
        configPath,
        onConfigChange: () => {
          markConfigChanged(learnSignals!)
          // Reload config to get updated slug list
          loadUserConfig().then(cfg => {
            if (cfg) currentConfigSlugs = cfg.map(c => c.slug)
          }).catch(() => {})
        }
      })
    }

    log('Learn mode active.')
  }

  // eslint-disable-next-line complexity
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const method = (req.method ?? 'GET') as 'GET' | 'POST' | 'PATCH' | 'DELETE'

    // Learn mode routes (before everything else)
    if (learnActive && learnSignals && currentLearnProgress) {
      if (url.pathname === '/_learn' && method === 'GET') {
        const { checkAllSteps, renderLearnPage } = await import('./learn/index.js')
        const deps = { pool, signals: learnSignals, configSlugs: currentConfigSlugs, projectDir }
        currentLearnProgress = await checkAllSteps(currentLearnProgress, deps)
        await writeLearnProgress(projectDir, currentLearnProgress)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(renderLearnPage(currentLearnProgress, port))
        return
      }

      if (url.pathname === '/_learn/api/progress' && method === 'GET') {
        const { checkAllSteps } = await import('./learn/index.js')
        const deps = { pool, signals: learnSignals, configSlugs: currentConfigSlugs, projectDir }
        currentLearnProgress = await checkAllSteps(currentLearnProgress, deps)
        await writeLearnProgress(projectDir, currentLearnProgress)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(currentLearnProgress))
        return
      }
    }

    // Try admin routes first
    const adminMatch = matchRoute(url.pathname, cms.adminRoutes)
    if (adminMatch) {
      if (learnActive && learnSignals) {
        const { incrementAdminViews } = await import('./learn/index.js')
        incrementAdminViews(learnSignals)
      }
      const handler = adminMatch.entry[method]
      if (handler) {
        await handler(req, res, adminMatch.params)
        return
      }
    }

    // Try REST API routes
    const restMatch = matchRoute(url.pathname, cms.restRoutes)
    if (restMatch) {
      if (learnActive && learnSignals && method === 'GET' && !req.headers['x-valence-learn']) {
        const { incrementApiGets } = await import('./learn/index.js')
        incrementApiGets(learnSignals)
      }
      const handler = restMatch.entry[method]
      if (handler) {
        await handler(req, res, restMatch.params)
        return
      }
      res.writeHead(405, { 'Content-Type': 'text/plain' })
      res.end('Method not allowed')
      return
    }

    // Splash page (available at /_splash always, or / when learn mode is off)
    if (url.pathname === '/_splash' || (url.pathname === '/' && !learnActive)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(landingPage(port))
      return
    }

    // Redirect / to /_learn when learn mode active
    if (url.pathname === '/' && learnActive) {
      res.writeHead(302, { Location: '/_learn' })
      res.end()
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<h1>404</h1><p>Not found</p>')
  })

  const learnLine = learnActive ? `\n  Tutorial: http://localhost:${port}/_learn` : ''

  server.listen(port, () => {
    console.log(`
  Valence dev server running.

  Site:  http://localhost:${port}
  Admin: http://localhost:${port}/admin${learnLine}

  Press Ctrl+C to stop.
`)
  })

  process.on('SIGINT', async () => {
    log('Shutting down...')
    if (configWatcher) configWatcher.close()
    server.close()
    await closePool(pool)
    process.exit(0)
  })
}

// -- migrate --

async function runMigrate (): Promise<void> {
  const config = loadEnvConfig()
  if (!config) {
    console.error('  Error: missing .env or database configuration. Run from your project root.')
    process.exit(1)
  }

  log('Connecting to database...')
  const result = await runMigrationsForProject(process.cwd(), config)
  if (result) {
    log('Migrations complete.')
  } else {
    log('Migration failed.')
    process.exit(1)
  }
}

// -- user:create --

async function runUserCreate (): Promise<void> {
  const config = loadEnvConfig()
  if (!config) {
    console.error('  Error: missing .env or database configuration.')
    process.exit(1)
  }

  const rl = createInterface({ input: stdin, output: stdout })
  const email = await ask(rl, 'Email', 'admin@localhost')
  const password = await ask(rl, 'Password', '')
  const name = await ask(rl, 'Name', 'Admin')
  if (rl) rl.close()

  if (!password) {
    console.error('  Error: password is required.')
    process.exit(1)
  }

  const pool = createPool(config)

  try {
    const { hashPassword } = await import('@valencets/cms')
    const hashResult = await hashPassword(password)
    if (hashResult.isErr()) {
      console.error('  Error hashing password:', hashResult.error.message)
      process.exit(1)
    }

    await pool.sql`
      INSERT INTO "users" ("id", "email", "password_hash", "name", "role")
      VALUES (gen_random_uuid(), ${email}, ${hashResult.value}, ${name}, 'admin')
    `
    log(`User "${email}" created.`)
  } finally {
    await closePool(pool)
  }
}

// -- build --

async function runBuild (): Promise<void> {
  log('Building for production...')
  const pm = detectPackageManager()
  exec(`${pm} exec tsc`, process.cwd())
  log('Build complete.')
}

// -- Route matching --

interface RouteMatch {
  readonly entry: Record<string, ((req: IncomingMessage, res: ServerResponse, ctx: Record<string, string>) => Promise<void>) | undefined>
  readonly params: Record<string, string>
}

function matchRoute (pathname: string, routes: Map<string, RestRouteEntry>): RouteMatch | null {
  // Exact match first
  const exact = routes.get(pathname)
  if (exact) return { entry: exact as RouteMatch['entry'], params: {} }

  // Pattern match (e.g., /api/:collection/:id)
  for (const [pattern, entry] of routes) {
    if (!pattern.includes(':')) continue

    const patternParts = pattern.split('/')
    const pathParts = pathname.split('/')
    if (patternParts.length !== pathParts.length) continue

    const params: Record<string, string> = {}
    let match = true
    for (let i = 0; i < patternParts.length; i++) {
      const pp = patternParts[i]!
      const up = pathParts[i]!
      if (pp.startsWith(':')) {
        params[pp.slice(1)] = up
      } else if (pp !== up) {
        match = false
        break
      }
    }

    if (match) return { entry: entry as RouteMatch['entry'], params }
  }

  return null
}

// -- Helpers --

function detectPackageManager (): string {
  if (existsSync(join(process.cwd(), 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(process.cwd(), 'yarn.lock'))) return 'yarn'
  return 'npm'
}

interface ConfigTemplateOptions {
  readonly dbName: string
  readonly dbUser: string
  readonly dbPassword: string
  readonly serverPort: string
  readonly learnMode: boolean
}

function generateConfigTemplate (opts: ConfigTemplateOptions): string {
  const { dbName, dbUser, dbPassword, serverPort, learnMode } = opts

  const learnComment = (text: string) => learnMode ? `// ${text}\n    ` : ''

  const tagsCollection = learnMode
    ? `,

    // ── LEARN MODE: Step 4 ──────────────────────────────────
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
    ${learnComment('Categories: a simple collection with text, slug, textarea, and select fields.')}collection({
      slug: 'categories',
      labels: { singular: 'Category', plural: 'Categories' },
      fields: [
        field.text({ name: 'name', required: true }),
        field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'name' }),
        field.textarea({ name: 'description' }),
        field.select({
          name: 'color',
          options: [
            { label: 'Blue', value: 'blue' },
            { label: 'Green', value: 'green' },
            { label: 'Red', value: 'red' },
            { label: 'Purple', value: 'purple' },
            { label: 'Amber', value: 'amber' }
          ]
        })
      ]
    }),

    ${learnComment('Posts: uses richtext for the body, a relation to categories, and a boolean toggle.')}collection({
      slug: 'posts',
      labels: { singular: 'Post', plural: 'Posts' },
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'title' }),
        field.richtext({ name: 'body' }),
        field.relation({ name: 'category', relationTo: 'categories' }),
        field.boolean({ name: 'published' }),
        field.date({ name: 'publishedAt' })
      ]
    }),

    ${learnComment('Pages: includes a status select, a date field, and a group for SEO metadata.')}collection({
      slug: 'pages',
      labels: { singular: 'Page', plural: 'Pages' },
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'title' }),
        field.richtext({ name: 'content' }),
        field.select({
          name: 'status',
          required: true,
          defaultValue: 'draft',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
            { label: 'Archived', value: 'archived' }
          ]
        }),
        field.date({ name: 'publishedAt' }),
        field.group({
          name: 'seo',
          label: 'SEO',
          fields: [
            field.text({ name: 'metaTitle', label: 'Meta Title' }),
            field.textarea({ name: 'metaDescription', label: 'Meta Description' })
          ]
        })
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
  }
})
`
}

function generateSecret (): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function loadEnvConfig (): DbConfig | null {
  const envPath = join(process.cwd(), '.env')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx)
      const value = trimmed.slice(eqIdx + 1)
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  }

  const host = process.env.DB_HOST
  const database = process.env.DB_NAME
  const username = process.env.DB_USER

  if (!host || !database || !username) return null

  return {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    database,
    username,
    password: process.env.DB_PASSWORD ?? '',
    max: 5,
    idle_timeout: 10,
    connect_timeout: 10
  }
}

async function runMigrationsForProject (projectDir: string, config: DbConfig): Promise<boolean> {
  const migrationsDir = join(projectDir, 'migrations')
  if (!existsSync(migrationsDir)) {
    log('No migrations directory found.')
    return true
  }

  const pool = createPool(config)
  const loadResult = await loadMigrations(migrationsDir)
  if (loadResult.isErr()) {
    log(`Error loading migrations: ${loadResult.error.message}`)
    return false
  }

  const migrations = loadResult.value
  if (migrations.length === 0) {
    log('No migrations to run.')
    return true
  }

  const result = await runMigrations(pool, migrations)
  await closePool(pool)

  if (result.isErr()) {
    log(`Migration error: ${result.error.message}`)
    return false
  }

  log(`Applied ${result.value} migration(s).`)
  return true
}

export async function seedDatabase (pool: { query: (text: string, values?: readonly (string | boolean | null)[]) => Promise<{ rows: Array<Record<string, string>> }> }): Promise<void> {
  // Insert a default category
  await pool.query(
    'INSERT INTO "categories" ("name", "slug", "color") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    ['General', 'general', 'blue']
  )

  // Get the category id for the post relation
  const catResult = await pool.query('SELECT id FROM "categories" WHERE "slug" = $1 LIMIT 1', ['general'])
  const catId = catResult.rows[0]?.id ?? null

  // Insert a welcome post
  await pool.query(
    'INSERT INTO "posts" ("title", "slug", "body", "category", "published") VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
    ['Welcome to Valence', 'welcome-to-valence', '<h2>Hello!</h2><p>This is your first post. Edit it from the admin panel.</p>', catId, true]
  )

  // Insert an about page
  await pool.query(
    'INSERT INTO "pages" ("title", "slug", "content", "status") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
    ['About', 'about', '<p>This is the about page.</p>', 'published']
  )
}

function landingPage (port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Valence</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .container { text-align: center; max-width: 480px; }
    h1 { font-size: 3rem; font-weight: 300; letter-spacing: 0.1em; margin-bottom: 1rem; }
    h1 span { font-weight: 600; color: #3b82f6; }
    p { color: #94a3b8; line-height: 1.6; margin-bottom: 2rem; }
    .links { display: flex; gap: 1rem; justify-content: center; }
    a { color: #3b82f6; text-decoration: none; padding: 0.5rem 1rem; border: 1px solid #3b82f6; border-radius: 6px; transition: all 0.15s; }
    a:hover { background: #3b82f6; color: #0f172a; }
    code { background: #1e293b; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="280" style="margin-bottom: 1rem;">
      <defs>
        <linearGradient id="orbital" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#60a5fa" stop-opacity="0"/>
          <stop offset="40%" stop-color="#60a5fa" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.7"/>
        </linearGradient>
      </defs>
      <ellipse cx="180" cy="40" rx="172" ry="32" stroke="url(#orbital)" stroke-width="1.5" fill="none" transform="rotate(-5, 180, 40)"/>
      <circle cx="350" cy="28" r="4" fill="#60a5fa">
        <animateMotion dur="4s" repeatCount="indefinite" path="M0,0 A172,32 -5 1 1 -340,24 A172,32 -5 1 1 0,0" />
      </circle>
      <text x="180" y="44" text-anchor="middle" font-family="system-ui, sans-serif" font-size="46" letter-spacing="0.1em" fill="#e2e8f0">
        <tspan font-weight="600" fill="#60a5fa">v</tspan><tspan font-weight="300">alence</tspan>
      </text>
    </svg>
    <p>Your site is running on port ${port}. Edit <code>valence.config.ts</code> to add collections, then visit the admin panel to create content.</p>
    <div class="links">
      <a href="/admin">Admin Panel</a>
      <a href="https://github.com/valencets/valence/wiki">Documentation</a>
    </div>
  </div>
</body>
</html>`
}

async function loadUserConfig (): Promise<ReadonlyArray<import('@valencets/cms').CollectionConfig> | null> {
  const configPath = join(process.cwd(), 'valence.config.ts')
  if (!existsSync(configPath)) {
    log('No valence.config.ts found.')
    return null
  }

  // If running under tsx (TS imports work), load directly
  try {
    const mod = await import(configPath)
    const result = mod.default
    if (result && typeof result.isOk === 'function' && result.isOk()) {
      return result.value.collections ?? []
    }
    return null
  } catch {
    // Direct import failed (no tsx loader). Try spawning with tsx.
    try {
      const script = [
        `import('${configPath.replace(/\\/g, '/')}')`,
        '.then(m => {',
        '  const r = m.default;',
        '  if (r && r.isOk && r.isOk()) {',
        '    process.stdout.write(JSON.stringify(r.value.collections.map(c => ({',
        '      slug: c.slug, labels: c.labels, auth: c.auth, upload: c.upload,',
        '      timestamps: c.timestamps, fields: c.fields',
        '    }))));',
        '  }',
        '})',
        '.catch(e => { process.stderr.write(e.message); process.exit(1); })'
      ].join('')
      const tsxBin = join(process.cwd(), 'node_modules', '.bin', 'tsx')
      const tsxArgs = ['-e', script]
      const output = existsSync(tsxBin)
        ? execFileSync(tsxBin, tsxArgs, { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 }).toString().trim()
        : execFileSync('npx', ['tsx', ...tsxArgs], { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 }).toString().trim()
      if (output) {
        const parsed = JSON.parse(output)
        // Re-hydrate through collection() to get proper CollectionConfig objects
        const { collection: col } = await import('@valencets/cms')
        return parsed.map((c: Record<string, unknown>) => col(c as Parameters<typeof col>[0]))
      }
    } catch (e2) {
      log(`Config load via tsx failed: ${e2 instanceof Error ? e2.message : 'unknown'}`)
    }
    return null
  }
}

// -- learn --

async function runLearn (args: ReadonlyArray<string>): Promise<void> {
  const projectDir = process.cwd()
  const progress = await readLearnProgress(projectDir)

  if (args.includes('--off')) {
    if (!progress) {
      log('Learn mode is not active. Run "valence init --learn" to enable it.')
      return
    }
    await writeLearnProgress(projectDir, { ...progress, enabled: false })
    log('Learn mode disabled.')
    return
  }

  if (args.includes('--reset')) {
    if (!progress) {
      log('Learn mode is not active. Run "valence init --learn" to enable it.')
      return
    }
    const reset = createInitialProgress(progress.initialCounts)
    await writeLearnProgress(projectDir, reset)
    log('Learn mode progress reset.')
    return
  }

  // Default: --status
  if (!progress) {
    log('Learn mode is not active.')
    log('Run "valence init --learn" to create a project with the tutorial,')
    log('or create .valence/learn.json manually.')
    return
  }

  const completedCount = Object.values(progress.steps).filter(s => s.completed).length
  log(`Learn mode: ${progress.enabled ? 'enabled' : 'disabled'}`)
  log(`Progress: ${completedCount} of 6 steps complete`)
  log(`Started: ${progress.startedAt}`)

  const stepNames: Record<string, string> = {
    'visit-admin': 'Visit the Admin Panel',
    'create-post': 'Create a Post',
    'hit-api': 'Hit the REST API',
    'add-collection': 'Add a New Collection',
    'create-user': 'Create an Admin User',
    'create-file': 'Create a Custom TypeScript File'
  }

  for (const [id, state] of Object.entries(progress.steps)) {
    const icon = state.completed ? '\u2713' : ' '
    log(`  [${icon}] ${stepNames[id] ?? id}`)
  }
}
