import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ResultAsync, fromThrowable } from '@valencets/resultkit'
import { createPool, closePool, loadMigrations, runMigrations } from '@valencets/db'
import type { DbConfig, DbPool } from '@valencets/db'
import { buildCms } from '@valencets/cms'
import type { RestRouteEntry } from '@valencets/cms'
import { readLearnProgress, writeLearnProgress, createInitialProgress } from './learn/index.js'
import { log } from './cli-utils.js'
import { generateConfigTemplate, generateSecret } from './config-template.js'
import { parseInitFlags, askWithDefault, confirmWithDefault, createDbInvocations, migrationTargets, initSummary, createPromptQueue } from './init-steps.js'
import { landingPage } from './landing-page.js'
import { loadEnvConfig, loadUserConfig, registerTsxLoader } from './config-loader.js'
import type { RouteHandler } from './define-config.js'
import { resolveCustomRoute } from './route-matcher.js'
import { generateCollectionRoutes, buildGeneratedRouteMap, buildUserRouteMap } from './route-generator.js'
import { resolveStaticPath, resolveMimeType, sendHtml, serveStaticFile, stripTrailingSlash, setSecurityHeaders } from '@valencets/core/server'
import { resolvePageRoute } from './page-router.js'
import { regenerateFromConfig, ensureGeneratedModules } from './codegen/regenerate.js'
import { startConfigWatcher } from './learn/watcher.js'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { scaffoldFsd } from './scaffold/fsd-scaffold.js'
import { toDevDbConfig, ensureDevDatabase } from './dev-database.js'

const COMMANDS = {
  init: 'Create a new Valence project',
  dev: 'Start the development server',
  start: 'Start the production server',
  migrate: 'Run pending database migrations',
  build: 'Build the project for production',
  'user:create': 'Create an admin user',
  learn: 'Manage learn mode tutorial',
  'telemetry:aggregate': 'Aggregate telemetry data for analytics dashboard'
} as const

type Command = keyof typeof COMMANDS

const commandMap: Record<Command, (args: ReadonlyArray<string>) => Promise<void>> = {
  init: runInit,
  dev: runDev,
  start: runStart,
  migrate: runMigrate,
  build: runBuild,
  'user:create': runUserCreate,
  learn: runLearn,
  'telemetry:aggregate': runTelemetryAggregate
}

export function normalizeRequestPathname (pathname: string): string {
  return stripTrailingSlash(pathname) ?? pathname
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

const safeExecSync = fromThrowable(
  (cmd: string, cwd: string, env?: Readonly<{ [key: string]: string }>) => {
    execSync(cmd, { cwd, stdio: 'pipe', ...(env !== undefined ? { env: { ...process.env, ...env } } : {}) })
  },
  () => null
)

function exec (cmd: string, cwd: string, env?: Readonly<{ [key: string]: string }>): boolean {
  return safeExecSync(cmd, cwd, env).isOk()
}

// -- init --

// eslint-disable-next-line complexity
async function runInit (args: ReadonlyArray<string>): Promise<void> {
  const nonFlagArgs = args.filter(a => !a.startsWith('--'))
  const flags = parseInitFlags(args)
  const useDefaults = flags.useDefaults
  const learnMode = flags.learnMode

  console.log('\n  Welcome to Valence.\n')

  const rlRaw = useDefaults ? null : createInterface({ input: stdin, output: stdout })
  const rl = rlRaw === null ? null : createPromptQueue(rlRaw, (prompt) => { stdout.write(prompt) })

  const projectName = useDefaults ? (nonFlagArgs[0] ?? 'my-valence-app') : await askWithDefault(rl!, 'Project name', nonFlagArgs[0] ?? 'my-valence-app')
  const dbName = useDefaults ? projectName.replace(/[^a-z0-9_]/g, '_') : await askWithDefault(rl!, 'Database name', projectName.replace(/[^a-z0-9_]/g, '_'))
  const dbHost = useDefaults ? 'localhost' : await askWithDefault(rl!, 'Database host', 'localhost')
  const dbPort = useDefaults ? '5432' : await askWithDefault(rl!, 'Database port', '5432')
  const dbUser = useDefaults ? 'postgres' : await askWithDefault(rl!, 'Database user', 'postgres')
  const dbPassword = useDefaults ? 'postgres' : await askWithDefault(rl!, 'Database password', 'postgres')
  const serverPort = useDefaults ? '3000' : await askWithDefault(rl!, 'Server port', '3000')

  if (!useDefaults) {
    console.log()
    log('Frontend framework:')
    log('  1. None (plain HTML templates)')
    log('  2. Astro (recommended for static + islands)')
    log('  3. Bring your own')
  }
  const frameworkChoice = useDefaults ? '1' : await askWithDefault(rl!, 'Choose', '1')

  const installDeps = !flags.noInstall && (useDefaults ? true : await confirmWithDefault(rl!, 'Install dependencies?', true))
  const createDb = !flags.noDb && (useDefaults ? true : await confirmWithDefault(rl!, `Create database "${dbName}"?`, true))
  const doMigrate = !flags.noMigrate && (useDefaults ? true : await confirmWithDefault(rl!, 'Run initial migrations?', true))
  const doSeed = !flags.noSeed && (useDefaults ? true : await confirmWithDefault(rl!, 'Insert sample seed data?', true))
  const initGit = !flags.noGit && (useDefaults ? true : await confirmWithDefault(rl!, 'Initialize git repository?', true))

  if (rlRaw) rlRaw.close()

  const dbAnswers = { dbName, dbHost, dbPort, dbUser, dbPassword }
  const failures: string[] = []

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

  const cliDir = dirname(fileURLToPath(import.meta.url))
  const cliPkg = JSON.parse(readFileSync(join(cliDir, '..', 'package.json'), 'utf-8')) as { version: string }
  const cliVersion = `^${cliPkg.version}`

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
      '@valencets/valence': cliVersion,
      '@valencets/cms': 'latest',
      '@valencets/db': 'latest',
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

  const envContent = `DB_HOST=${dbHost}
DB_PORT=${dbPort}
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
PORT=${serverPort}
CMS_SECRET=${generateSecret()}
`
  await writeFile(join(dir, '.env'), envContent)
  const envExampleContent = `DB_HOST=${dbHost}
DB_PORT=${dbPort}
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=
PORT=${serverPort}
CMS_SECRET=change-me
`
  await writeFile(join(dir, '.env.example'), envExampleContent)

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

-- Valence column naming rules:
-- System columns use snake_case:  id, created_at, updated_at, deleted_at
-- User fields keep their config name: field.text({ name: 'title' }) → "title"
-- IMPORTANT: Every CMS-managed table MUST include created_at, updated_at, deleted_at

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

CREATE TABLE IF NOT EXISTS "session_summaries" (
  "id" SERIAL PRIMARY KEY,
  "period_start" TIMESTAMPTZ NOT NULL,
  "period_end" TIMESTAMPTZ NOT NULL,
  "total_sessions" INT,
  "unique_referrers" INT,
  "device_mobile" INT,
  "device_desktop" INT,
  "device_tablet" INT,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("period_start", "period_end")
);

CREATE TABLE IF NOT EXISTS "event_summaries" (
  "id" SERIAL PRIMARY KEY,
  "period_start" TIMESTAMPTZ NOT NULL,
  "period_end" TIMESTAMPTZ NOT NULL,
  "event_category" VARCHAR(100),
  "total_count" INT,
  "unique_sessions" INT,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("period_start", "period_end", "event_category")
);

CREATE TABLE IF NOT EXISTS "conversion_summaries" (
  "id" SERIAL PRIMARY KEY,
  "period_start" TIMESTAMPTZ NOT NULL,
  "period_end" TIMESTAMPTZ NOT NULL,
  "intent_type" VARCHAR(100),
  "total_count" INT,
  "top_sources" JSONB DEFAULT '[]',
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("period_start", "period_end", "intent_type")
);

CREATE TABLE IF NOT EXISTS "ingestion_health" (
  "id" SERIAL PRIMARY KEY,
  "period_start" TIMESTAMPTZ NOT NULL,
  "payloads_accepted" INT,
  "payloads_rejected" INT,
  "avg_processing_ms" FLOAT,
  "buffer_saturation_pct" FLOAT,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

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

-- Store tables (user-scoped store state persistence)
CREATE TABLE IF NOT EXISTS "store_states" (
  "store_slug" TEXT NOT NULL,
  "state_key" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  PRIMARY KEY ("store_slug", "state_key")
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
      failures.push(`dependency install failed — run \`${pm} install\` in ${projectName}/`)
    } else {
      log('Dependencies installed.')
    }
  }

  if (createDb) {
    // Both databases up front: valence dev works on the _dev sibling,
    // valence start on the base — neither first run should trip.
    for (const invocation of createDbInvocations(dbAnswers)) {
      log(`Creating database: ${invocation.command.split(' ').pop() ?? ''}...`)
      if (exec(invocation.command, dir, invocation.env)) {
        log('Database created.')
      } else {
        log('Warning: could not create it — it may already exist, or the connection details are wrong.')
      }
    }
  }

  if (doMigrate) {
    let baseMigrated = false
    for (const target of migrationTargets(dbAnswers)) {
      log(`Running migrations on "${target.database}"...`)
      const migrated = await runMigrationsForProject(dir, target)
      if (migrated) {
        log('Migrations applied.')
        if (target.database === dbName) baseMigrated = true
      } else {
        log('Warning: migrations failed. Run "valence migrate" after fixing your database connection.')
        failures.push(`migrations failed on ${target.database} — run \`valence migrate\` after fixing the connection`)
      }
    }
    if (baseMigrated) {
      if (doSeed) {
        log('Seeding initial data...')
        const seedPool = createPool({
          host: dbHost,
          port: Number(dbPort),
          database: dbName,
          username: dbUser,
          password: dbPassword,
          max: 5,
          idle_timeout: 10,
          connect_timeout: 10
        })
        const seedResult = await ResultAsync.fromPromise(
          (async () => { await seedDatabase(seedPool); await closePool(seedPool) })(),
          () => null
        )
        if (seedResult.isOk()) {
          log('Seed data inserted.')
        } else {
          log('Warning: seed data insertion failed. The database may already have data.')
        }
      }
    }
  }

  if (initGit) {
    if (exec('git init', dir) && exec('git add -A', dir) && exec('git commit -m "Initial commit from valence init"', dir)) {
      log('Git repository initialized.')
    } else {
      failures.push('git initialization failed')
    }
  }

  console.log(initSummary(projectName, serverPort, failures, learnMode))
}

// -- dev --

async function runDev (): Promise<void> {
  await registerTsxLoader()
  const config = loadEnvConfig()
  if (!config) {
    console.error('  Error: missing .env or database configuration. Run from your project root.')
    process.exit(1)
  }

  const devConfig = toDevDbConfig(config)

  const port = Number(process.env.PORT ?? 3000)
  const projectDir = process.cwd()

  await ensureDevDatabase(devConfig, { createPool, closePool })

  log('Running migrations...')
  await runMigrationsForProject(projectDir, devConfig)

  log('Loading config...')
  const loadedConfig = await loadUserConfig()
  if (!loadedConfig) {
    console.error('  Error: could not load valence.config.ts. Make sure it exists and exports defineConfig().')
    process.exit(1)
  }

  const userConfig = loadedConfig.collections
  const telemetryEnabled = loadedConfig.telemetry?.enabled ?? false

  log('Building CMS...')
  const pool = createPool(devConfig)

  const devCmsSecret = process.env.CMS_SECRET ?? 'dev-secret'
  const cmsResult = buildCms({
    db: pool,
    secret: devCmsSecret,
    uploadDir: join(projectDir, 'uploads'),
    collections: userConfig,
    telemetryPool: telemetryEnabled ? pool : undefined,
    telemetrySiteId: loadedConfig.telemetry?.siteId,
    requireAuth: loadedConfig.admin?.requireAuth
  })

  if (cmsResult.isErr()) {
    console.error('  CMS build failed:', cmsResult.error.message)
    process.exit(1)
  }

  const cms = cmsResult.value

  // Fire plugin onInit hooks
  for (const hooks of cms.pluginHooks) {
    if (hooks.onInit) await hooks.onInit(cms)
  }

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
          // Reload config to get updated slug list + regenerate codegen.
          // Body runs inside the fromPromise boundary so a malformed config
          // (throwing in the handler) is contained, not an unhandled rejection.
          ResultAsync.fromPromise(
            loadUserConfig().then((cfg) => {
              if (!cfg) return
              currentConfigSlugs = cfg.collections.map(c => c.slug)
              regenerateFromConfig(projectDir, cfg.collections, cfg.stores).match(
                (result) => {
                  const total = result.added.length + result.updated.length
                  if (total > 0) log(`Regenerated ${total} file(s). Skipped ${result.skipped.length} user-edited.`)
                },
                (e) => { log(`Regeneration error: ${e.message}`) }
              )
            }),
            (e) => e
          ).match(() => undefined, (e) => { log('Config reload failed: ' + (e instanceof Error ? e.message : 'unknown')) })
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
        // Body runs inside the fromPromise boundary so a malformed config
        // (throwing in the handler) is contained, not an unhandled rejection.
        ResultAsync.fromPromise(
          loadUserConfig().then((cfg) => {
            if (!cfg) return
            currentConfigSlugs = cfg.collections.map(c => c.slug)
            regenerateFromConfig(projectDir, cfg.collections, cfg.stores).match(
              (result) => {
                const total = result.added.length + result.updated.length
                if (total > 0) log(`Regenerated ${total} file(s). Skipped ${result.skipped.length} user-edited.`)
              },
              (e) => { log(`Regeneration error: ${e.message}`) }
            )
          }),
          (e) => e
        ).match(() => undefined, (e) => { log('Config reload failed: ' + (e instanceof Error ? e.message : 'unknown')) })
      }
    })
  }

  // eslint-disable-next-line complexity
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const pathname = normalizeRequestPathname(url.pathname)
    const method = (req.method ?? 'GET') as 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

    // Global security headers — baseline for all responses
    // Admin routes will override CSP with nonce-based policy via sendHtml()
    setSecurityHeaders(res)

    // Health check — before all other processing
    if (pathname === '/health' && (method === 'GET' || method === 'HEAD')) {
      res.setHeader('Cache-Control', 'no-store')
      const body = JSON.stringify({ status: 'ok', uptime: process.uptime() })
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
      res.end(method === 'HEAD' ? undefined : body)
      return
    }

    // Body-limit check for requests with Content-Length header
    if (method === 'POST' || method === 'PATCH') {
      const contentLength = req.headers['content-length']
      if (contentLength !== undefined) {
        const length = parseInt(contentLength, 10)
        if (!Number.isNaN(length) && length > 10_485_760) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Request entity too large' }))
          return
        }
      }
    }

    // Learn mode routes (before everything else)
    if (learnActive && learnSignals && currentLearnProgress) {
      if (pathname === '/_learn' && method === 'GET') {
        const { checkAllSteps, renderLearnPage } = await import('./learn/index.js')
        const deps = { pool, signals: learnSignals, configSlugs: currentConfigSlugs, projectDir }
        currentLearnProgress = await checkAllSteps(currentLearnProgress, deps)
        await writeLearnProgress(projectDir, currentLearnProgress)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(renderLearnPage(currentLearnProgress, port))
        return
      }

      if (pathname === '/_learn/api/progress' && method === 'GET') {
        const { checkAllSteps } = await import('./learn/index.js')
        const deps = { pool, signals: learnSignals, configSlugs: currentConfigSlugs, projectDir }
        currentLearnProgress = await checkAllSteps(currentLearnProgress, deps)
        await writeLearnProgress(projectDir, currentLearnProgress)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(currentLearnProgress))
        return
      }
    }

    // Try custom registered routes (from onServer registerRoute calls)
    const customMatch = resolveCustomRoute(customRoutes, method, pathname)
    if (customMatch) {
      await customMatch.handler(req, res, customMatch.params)
      return
    }

    // Try user-defined routes with loaders/actions (from loadedConfig.routes)
    const userMatch = resolveCustomRoute(userRouteMap, method, pathname)
    if (userMatch) {
      await userMatch.handler(req, res, userMatch.params)
      return
    }

    // Try schema-generated collection routes (after custom, before admin)
    const generatedMatch = resolveCustomRoute(generatedRouteMap, method, pathname)
    if (generatedMatch) {
      await generatedMatch.handler(req, res, generatedMatch.params)
      return
    }

    // Try admin routes first
    const adminMatch = matchRoute(pathname, cms.adminRoutes)
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
    const restMatch = matchRoute(pathname, cms.restRoutes)
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
    const staticResult = resolveStaticPath(pathname, publicDir)
    if (staticResult.isOk()) {
      const filePath = staticResult.value
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const mime = resolveMimeType(filePath)
        const rangeHeader = typeof req.headers['range'] === 'string' ? req.headers['range'] : undefined
        await serveStaticFile(filePath, mime, rangeHeader, res)
        return
      }
    }

    // User pages from src/pages/
    const srcDir = join(projectDir, 'src')
    const pageHtmlPath = resolvePageRoute(pathname, srcDir)
    if (pageHtmlPath !== null && existsSync(pageHtmlPath)) {
      const pageContent = readFileSync(pageHtmlPath, 'utf-8')
      const hydrated = storeHydrator ? await storeHydrator(req, res, pageContent) : pageContent
      sendHtml(res, hydrated)
      return
    }

    // Splash page (available at /_splash always, or / when learn mode is off)
    if (pathname === '/_splash' || (pathname === '/' && !learnActive)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(landingPage(port))
      return
    }

    // Redirect / to /_learn when learn mode active
    if (pathname === '/' && learnActive) {
      res.writeHead(302, { Location: '/_learn' })
      res.end()
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<h1>404</h1><p>Not found</p>')
  })

  const learnLine = learnActive ? `\n  Tutorial: http://localhost:${port}/_learn` : ''

  // Custom route map: path → method → handler
  const customRoutes = new Map<string, Map<string, RouteHandler>>()
  const registerRoute = (method: string, path: string, handler: RouteHandler): void => {
    const methodUpper = method.toUpperCase()
    let methodMap = customRoutes.get(path)
    if (!methodMap) {
      methodMap = new Map<string, RouteHandler>()
      customRoutes.set(path, methodMap)
    }
    methodMap.set(methodUpper, handler)
  }

  // Allow the consuming app to attach WebSocket upgrade handlers or custom routes
  // before the server begins accepting connections.
  if (loadedConfig.onServer) {
    await loadedConfig.onServer({ server, pool, cms, registerRoute })
  }

  // Generated modules must exist before the first bundle build — a fresh
  // checkout works without touching the config first.
  await ensureGeneratedModules(projectDir, loadedConfig.collections, loadedConfig.stores, log)

  // Bundle and serve the client entry (no-op if the project ships none)
  const clientBundleUrl = await setupClientBundle(projectDir, registerRoute, true, log)

  // Register store routes (no-op if no stores defined)
  const { maybeRegisterStores } = await import('./store-wiring.js')
  const storeHydrator = maybeRegisterStores(loadedConfig.stores, registerRoute, log, pool, devCmsSecret, clientBundleUrl)

  // Schema-driven generated route map (custom routes take priority)
  const generatedRoutes = generateCollectionRoutes(userConfig, loadedConfig.routes)
  const generatedRouteMap = buildGeneratedRouteMap(generatedRoutes, projectDir, storeHydrator)

  // User-defined routes with loaders/actions
  const userRouteMap = buildUserRouteMap(loadedConfig.routes, projectDir, pool, cms, storeHydrator)

  server.listen(port, async () => {
    // Fire plugin onReady hooks
    for (const hooks of cms.pluginHooks) {
      if (hooks.onReady) await hooks.onReady(cms)
    }

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

// -- start --

async function setupClientBundle (
  projectDir: string,
  registerRoute: (method: string, path: string, handler: RouteHandler) => void,
  watch: boolean,
  logFn: (msg: string) => void
): Promise<string | undefined> {
  const { resolveClientEntry, createClientBundler, registerClientBundleRoute, CLIENT_BUNDLE_PATH } = await import('./client-bundler.js')
  if (resolveClientEntry(projectDir) === null) return undefined

  return await createClientBundler({ projectDir, watch, log: logFn }).match(
    (bundler) => {
      registerClientBundleRoute(registerRoute, bundler)
      logFn(`Client bundle served at ${CLIENT_BUNDLE_PATH}`)
      return CLIENT_BUNDLE_PATH
    },
    (e) => {
      logFn(`Client bundler failed to start: ${e.message}`)
      return undefined
    }
  )
}

export async function runStart (): Promise<void> {
  await registerTsxLoader()
  const config = loadEnvConfig()
  if (!config) {
    console.error('  Error: missing .env or database configuration. Run from your project root.')
    process.exit(1)
  }

  const rawPort = process.env.PORT ?? '3000'
  const port = Number(rawPort)
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    console.error(`  Error: invalid PORT "${rawPort}". Must be a number between 1 and 65535.`)
    process.exit(1)
  }

  const cmsSecret = process.env.CMS_SECRET
  if (!cmsSecret) {
    console.error('  Error: CMS_SECRET must be set in .env for production.')
    process.exit(1)
  }

  const projectDir = process.cwd()

  log('Running migrations...')
  const migrated = await runMigrationsForProject(projectDir, config)
  if (!migrated) {
    console.error('  Error: migrations failed. Fix your database before starting.')
    process.exit(1)
  }

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
    secret: cmsSecret,
    uploadDir: join(projectDir, 'uploads'),
    collections: userConfig,
    telemetryPool: telemetryEnabled ? pool : undefined,
    telemetrySiteId: loadedConfig.telemetry?.siteId,
    requireAuth: loadedConfig.admin?.requireAuth
  })

  if (cmsResult.isErr()) {
    console.error('  CMS build failed:', cmsResult.error.message)
    process.exit(1)
  }

  const cms = cmsResult.value

  // Fire plugin onInit hooks
  for (const hooks of cms.pluginHooks) {
    if (hooks.onInit) await hooks.onInit(cms)
  }

  // eslint-disable-next-line complexity
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const pathname = normalizeRequestPathname(url.pathname)
    const method = (req.method ?? 'GET') as 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

    // Global security headers — baseline for all responses
    // Admin routes will override CSP with nonce-based policy via sendHtml()
    setSecurityHeaders(res)

    // Health check — before all other processing
    if (pathname === '/health' && (method === 'GET' || method === 'HEAD')) {
      res.setHeader('Cache-Control', 'no-store')
      const body = JSON.stringify({ status: 'ok', uptime: process.uptime() })
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
      res.end(method === 'HEAD' ? undefined : body)
      return
    }

    // Body-limit check for requests with Content-Length header
    if (method === 'POST' || method === 'PATCH') {
      const contentLength = req.headers['content-length']
      if (contentLength !== undefined) {
        const length = parseInt(contentLength, 10)
        if (!Number.isNaN(length) && length > 10_485_760) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Request entity too large' }))
          return
        }
      }
    }

    // Try custom registered routes (from onServer registerRoute calls)
    const customMatch = resolveCustomRoute(customRoutes, method, pathname)
    if (customMatch) {
      await customMatch.handler(req, res, customMatch.params)
      return
    }

    // Try user-defined routes with loaders/actions (from loadedConfig.routes)
    const userMatch = resolveCustomRoute(userRouteMap, method, pathname)
    if (userMatch) {
      await userMatch.handler(req, res, userMatch.params)
      return
    }

    // Try schema-generated collection routes (after custom, before admin)
    const generatedMatch = resolveCustomRoute(generatedRouteMap, method, pathname)
    if (generatedMatch) {
      await generatedMatch.handler(req, res, generatedMatch.params)
      return
    }

    // Try admin routes first
    const adminMatch = matchRoute(pathname, cms.adminRoutes)
    if (adminMatch) {
      const handler = adminMatch.entry[method]
      if (handler) {
        await handler(req, res, adminMatch.params)
        return
      }
    }

    // Try REST API routes
    const restMatch = matchRoute(pathname, cms.restRoutes)
    if (restMatch) {
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
    const staticResult = resolveStaticPath(pathname, publicDir)
    if (staticResult.isOk()) {
      const filePath = staticResult.value
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const mime = resolveMimeType(filePath)
        const rangeHeader = typeof req.headers['range'] === 'string' ? req.headers['range'] : undefined
        await serveStaticFile(filePath, mime, rangeHeader, res)
        return
      }
    }

    // User pages from src/pages/
    const srcDir = join(projectDir, 'src')
    const pageHtmlPath = resolvePageRoute(pathname, srcDir)
    if (pageHtmlPath !== null && existsSync(pageHtmlPath)) {
      const pageContent = readFileSync(pageHtmlPath, 'utf-8')
      const hydrated = storeHydrator ? await storeHydrator(req, res, pageContent) : pageContent
      sendHtml(res, hydrated)
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<h1>404</h1><p>Not found</p>')
  })

  // Custom route map: path → method → handler
  const customRoutes = new Map<string, Map<string, RouteHandler>>()
  const registerRoute = (method: string, path: string, handler: RouteHandler): void => {
    const methodUpper = method.toUpperCase()
    let methodMap = customRoutes.get(path)
    if (!methodMap) {
      methodMap = new Map<string, RouteHandler>()
      customRoutes.set(path, methodMap)
    }
    methodMap.set(methodUpper, handler)
  }

  // Allow the consuming app to attach WebSocket upgrade handlers or custom routes
  if (loadedConfig.onServer) {
    await loadedConfig.onServer({ server, pool, cms, registerRoute })
  }

  // Generated modules must exist before the production bundle builds
  await ensureGeneratedModules(projectDir, loadedConfig.collections, loadedConfig.stores, log)

  // Bundle and serve the client entry (no-op if the project ships none)
  const clientBundleUrl = await setupClientBundle(projectDir, registerRoute, false, log)

  // Register store routes (no-op if no stores defined)
  const { maybeRegisterStores: maybeRegisterStoresProd } = await import('./store-wiring.js')
  const storeHydrator = maybeRegisterStoresProd(loadedConfig.stores, registerRoute, undefined, pool, cmsSecret, clientBundleUrl)

  // Schema-driven generated route map (custom routes take priority)
  const generatedRoutes = generateCollectionRoutes(userConfig, loadedConfig.routes)
  const generatedRouteMap = buildGeneratedRouteMap(generatedRoutes, projectDir, storeHydrator)

  // User-defined routes with loaders/actions
  const userRouteMap = buildUserRouteMap(loadedConfig.routes, projectDir, pool, cms, storeHydrator)

  server.listen(port, async () => {
    // Fire plugin onReady hooks
    for (const hooks of cms.pluginHooks) {
      if (hooks.onReady) await hooks.onReady(cms)
    }

    console.log(`
  Valence server running.

  Site:  http://localhost:${port}
  Admin: http://localhost:${port}/admin

  Press Ctrl+C to stop.
`)
  })

  const shutdown = async () => {
    log('Shutting down...')
    server.close(async () => {
      await closePool(pool)
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
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

  const { hashPassword } = await import('@valencets/cms')
  const hashResult = await hashPassword(password)
  if (hashResult.isErr()) {
    await closePool(pool)
    console.error('  Error hashing password:', hashResult.error.message)
    process.exit(1)
  }

  await ResultAsync.fromPromise(
    pool.sql`
      INSERT INTO "users" ("id", "email", "password_hash", "name", "role")
      VALUES (gen_random_uuid(), ${email}, ${hashResult.value}, ${name}, 'admin')
    `,
    (e) => e
  )
  await closePool(pool)
  log(`User "${email}" created.`)
}

// -- build --

async function runBuild (): Promise<void> {
  log('Building for production...')
  const pm = detectPackageManager()
  const ok = exec(`${pm} exec tsc`, process.cwd())
  if (!ok) {
    console.error('Build failed — TypeScript compilation errors above.')
    process.exit(1)
  }
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

// -- telemetry:aggregate --
async function runTelemetryAggregate (_args: ReadonlyArray<string>): Promise<void> {
  const dbConfig = loadEnvConfig()
  if (!dbConfig) {
    console.error('  Error: missing .env or database configuration. Run from your project root.')
    process.exit(1)
  }

  const loadedConfig = await loadUserConfig()
  const siteId = loadedConfig?.telemetry?.siteId ?? 'default'

  log('Connecting to database...')
  const pool = createPool(dbConfig)

  const aggregateResult = await ResultAsync.fromPromise(
    (async () => {
      const { aggregateSessionSummary, aggregateEventSummary, aggregateConversionSummary } = await import('@valencets/telemetry')
      const { generateDailySummary } = await import('@valencets/telemetry')

      const now = new Date()
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const dayEnd = new Date(dayStart.getTime() + 86_400_000)
      const period = { start: dayStart, end: dayEnd }

      log(`Aggregating telemetry for ${dayStart.toISOString().slice(0, 10)}...`)

      const sessionResult = await aggregateSessionSummary(pool, period)
      sessionResult.match(
        (row) => { log(`  Sessions: ${row.total_sessions} total`) },
        (err) => { log(`  Session aggregation skipped: ${err.message}`) }
      )

      const eventResult = await aggregateEventSummary(pool, period)
      eventResult.match(
        (rows) => { log(`  Events: ${rows.length} categories aggregated`) },
        (err) => { log(`  Event aggregation skipped: ${err.message}`) }
      )

      const conversionResult = await aggregateConversionSummary(pool, period)
      conversionResult.match(
        (rows) => { log(`  Conversions: ${rows.length} intent types aggregated`) },
        (err) => { log(`  Conversion aggregation skipped: ${err.message}`) }
      )

      const dailyResult = await generateDailySummary(pool, siteId, 'default', now)
      dailyResult.match(
        (row) => { log(`  Daily summary: ${row.session_count} sessions, ${row.pageview_count} pageviews, ${row.conversion_count} conversions`) },
        (err) => { log(`  Daily summary skipped: ${err.message}`) }
      )

      log('Aggregation complete.')
    })(),
    (err) => err
  )

  await closePool(pool)

  if (aggregateResult.isErr()) {
    const e = aggregateResult.error
    console.error('  Aggregation failed:', e instanceof Error ? e.message : 'unknown error')
    process.exit(1)
  }
}

async function runMigrationsForProject (projectDir: string, config: DbConfig): Promise<boolean> {
  const migrationsDir = join(projectDir, 'migrations')
  if (!existsSync(migrationsDir)) {
    log('No migrations directory found.')
    return true
  }

  const pool = createPool(config)

  // Run telemetry package migrations first (if telemetry is enabled)
  const telemetryMigrationsDir = join(projectDir, 'node_modules', '@valencets', 'telemetry', 'migrations')
  if (existsSync(telemetryMigrationsDir)) {
    const telLoadResult = await loadMigrations(telemetryMigrationsDir)
    if (telLoadResult.isOk() && telLoadResult.value.length > 0) {
      const telResult = await runMigrations(pool, telLoadResult.value)
      if (telResult.isOk() && telResult.value > 0) {
        log(`Applied ${telResult.value} telemetry migration(s).`)
      }
    }
  }

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

  // Validate column naming conventions on all tables (best-effort, non-fatal)
  await ResultAsync.fromPromise(
    (async () => {
      const tables = await pool.sql.unsafe(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
      )
      for (const t of tables) {
        const tableName = String(Reflect.get(t, 'table_name') ?? '')
        const cols = await pool.sql.unsafe(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
          [tableName]
        )
        const colNames = Array.from(cols).map(c => String(Reflect.get(c, 'column_name') ?? ''))
        // Check for camelCase system columns (common mistake)
        const camelCaseSystemCols = ['createdAt', 'updatedAt', 'deletedAt']
        for (const bad of camelCaseSystemCols) {
          if (colNames.includes(bad)) {
            const snakeVersion = bad.replace(/([A-Z])/g, '_$1').toLowerCase()
            log(`  ⚠ Table "${tableName}" has "${bad}" — CMS expects "${snakeVersion}". Run: ALTER TABLE "${tableName}" RENAME COLUMN "${bad}" TO ${snakeVersion};`)
          }
        }
        // Check if CMS system columns are missing
        if (!colNames.includes('deleted_at') && colNames.includes('created_at')) {
          log(`  ⚠ Table "${tableName}" is missing "deleted_at" column — CMS soft-delete will not work.`)
        }
      }
    })(),
    () => null
  )

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
