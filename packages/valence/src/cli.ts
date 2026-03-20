import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createPool, closePool, loadMigrations, runMigrations } from '@valencets/db'
import type { DbConfig, DbPool } from '@valencets/db'
import { buildCms } from '@valencets/cms'
import type { RestRouteEntry } from '@valencets/cms'
import { readLearnProgress, writeLearnProgress, createInitialProgress } from './learn/index.js'
import { log } from './cli-utils.js'
import { generateConfigTemplate, generateSecret } from './config-template.js'
import { landingPage } from './landing-page.js'
import { loadEnvConfig, loadUserConfig } from './config-loader.js'
import { resolveStaticPath, resolveMimeType, sendHtml } from '@valencets/core/server'
import { resolvePageRoute } from './page-router.js'
import { regenerateFromConfig } from './codegen/regenerate.js'
import { startConfigWatcher } from './learn/watcher.js'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { scaffoldFsd } from './scaffold/fsd-scaffold.js'

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
      '@valencets/valence': '^0.7.1',
      '@valencets/cms': '^0.2.1',
      '@valencets/db': '^0.1.2',
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

CREATE TABLE IF NOT EXISTS "posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "body" TEXT,
  "published" BOOLEAN DEFAULT false,
  "publishedAt" TIMESTAMPTZ,
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


CREATE TABLE IF NOT EXISTS "cms_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "document_revisions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "collection_slug" TEXT NOT NULL,
  "document_id" UUID NOT NULL,
  "revision_number" INT NOT NULL,
  "data" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("collection_slug", "document_id", "revision_number")
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

  // Scaffold FSD src/ directory from the collections we just wrote
  const { collection: col, field: f } = await import('@valencets/cms')
  const initCollections = [
    col({
      slug: 'posts',
      labels: { singular: 'Post', plural: 'Posts' },
      fields: [
        f.text({ name: 'title', required: true }),
        f.slug({ name: 'slug', required: true, unique: true, slugFrom: 'title' }),
        f.richtext({ name: 'body' }),
        f.boolean({ name: 'published' }),
        f.date({ name: 'publishedAt' })
      ]
    }),
    col({
      slug: 'users',
      auth: true,
      fields: [
        f.text({ name: 'name', required: true }),
        f.select({ name: 'role', defaultValue: 'editor', options: [{ label: 'Admin', value: 'admin' }, { label: 'Editor', value: 'editor' }] })
      ]
    })
  ]
  await scaffoldFsd({ projectDir: dir, collections: initCollections })
  log('FSD source directory scaffolded.')

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
          await seedDatabase(seedPool)
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
  const loadedConfig = await loadUserConfig()
  if (!loadedConfig) {
    console.error('  Error: could not load valence.config.ts. Make sure it exists and exports defineConfig().')
    process.exit(1)
  }

  const userConfig = loadedConfig.collections
  const telemetryEnabled = loadedConfig.telemetry?.enabled ?? false

  log('Building CMS...')
  const pool = createPool(config)

  const cmsResult = buildCms({
    db: pool,
    secret: process.env.CMS_SECRET ?? 'dev-secret',
    uploadDir: join(projectDir, 'uploads'),
    collections: userConfig,
    telemetryPool: telemetryEnabled ? pool : undefined
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
          // Reload config to get updated slug list + regenerate codegen
          loadUserConfig().then(cfg => {
            if (!cfg) return
            currentConfigSlugs = cfg.collections.map(c => c.slug)
            regenerateFromConfig(projectDir, cfg.collections).match(
              (result) => {
                const total = result.added.length + result.updated.length
                if (total > 0) log(`Regenerated ${total} file(s). Skipped ${result.skipped.length} user-edited.`)
              },
              (e) => { log(`Regeneration error: ${e.message}`) }
            )
          }).catch((e) => { log('Config reload failed: ' + (e instanceof Error ? e.message : 'unknown')) })
        }
      })
    }

    log('Learn mode active.')
  }

  // Config watcher — always active, regenerates codegen on changes
  const configPath = join(projectDir, 'valence.config.ts')
  if (!configWatcher && existsSync(configPath)) {
    configWatcher = startConfigWatcher({
      configPath,
      onConfigChange: () => {
        loadUserConfig().then(cfg => {
          if (!cfg) return
          currentConfigSlugs = cfg.collections.map(c => c.slug)
          regenerateFromConfig(projectDir, cfg.collections).match(
            (result) => {
              const total = result.added.length + result.updated.length
              if (total > 0) log(`Regenerated ${total} file(s). Skipped ${result.skipped.length} user-edited.`)
            },
            (e) => { log(`Regeneration error: ${e.message}`) }
          )
        }).catch((e) => { log('Config reload failed: ' + (e instanceof Error ? e.message : 'unknown')) })
      }
    })
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

    // Static files from public/
    const publicDir = join(projectDir, 'public')
    const staticResult = resolveStaticPath(url.pathname, publicDir)
    if (staticResult.isOk()) {
      const filePath = staticResult.value
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const fileContent = readFileSync(filePath)
        const mime = resolveMimeType(filePath)
        res.writeHead(200, { 'Content-Type': mime })
        res.end(fileContent)
        return
      }
    }

    // User pages from src/pages/
    const srcDir = join(projectDir, 'src')
    const pageHtmlPath = resolvePageRoute(url.pathname, srcDir)
    if (pageHtmlPath !== null && existsSync(pageHtmlPath)) {
      const pageContent = readFileSync(pageHtmlPath, 'utf-8')
      sendHtml(res, pageContent)
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

export async function seedDatabase (pool: DbPool): Promise<void> {
  // Insert a welcome post
  await pool.sql.unsafe(
    'INSERT INTO "posts" ("title", "slug", "body", "published") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
    ['Welcome to Valence', 'welcome-to-valence', '<h2>Hello!</h2><p>This is your first post. Edit it from the admin panel.</p>', true]
  )
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
