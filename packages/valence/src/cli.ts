import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { createPool, loadMigrations, runMigrations } from '@valencets/db'
import type { DbConfig } from '@valencets/db'

const COMMANDS = {
  init: 'Create a new Valence project',
  dev: 'Start the development server',
  migrate: 'Run pending database migrations',
  build: 'Build the project for production'
} as const

type Command = keyof typeof COMMANDS

const commandMap: Record<Command, (args: ReadonlyArray<string>) => Promise<void>> = {
  init: runInit,
  dev: runDev,
  migrate: runMigrate,
  build: runBuild
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
    console.log(`    ${name.padEnd(12)} ${desc}`)
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

async function runInit (args: ReadonlyArray<string>): Promise<void> {
  console.log('\n  Welcome to Valence.\n')

  const rl = createInterface({ input: stdin, output: stdout })

  const projectName = await ask(rl, 'Project name', args[0] ?? 'my-valence-app')
  const dbName = await ask(rl, 'Database name', projectName.replace(/[^a-z0-9_]/g, '_'))
  const dbUser = await ask(rl, 'Database user', 'postgres')
  const dbPassword = await ask(rl, 'Database password', '')
  const serverPort = await ask(rl, 'Server port', '3000')

  console.log()
  log('Frontend framework:')
  log('  1. None (plain HTML templates)')
  log('  2. Astro (recommended for static + islands)')
  log('  3. Bring your own')
  const frameworkChoice = await ask(rl, 'Choose', '1')

  const installDeps = await confirm(rl, 'Install dependencies?')
  const createDb = await confirm(rl, `Create database "${dbName}"?`)
  const doMigrate = await confirm(rl, 'Run initial migrations?')
  const initGit = await confirm(rl, 'Initialize git repository?')

  rl.close()

  const dir = join(process.cwd(), projectName)
  console.log()
  log(`Creating ${projectName}...`)

  // Scaffold directories
  await mkdir(dir, { recursive: true })
  await mkdir(join(dir, 'collections'), { recursive: true })
  await mkdir(join(dir, 'migrations'), { recursive: true })
  await mkdir(join(dir, 'public'), { recursive: true })
  await mkdir(join(dir, 'templates'), { recursive: true })
  await mkdir(join(dir, 'uploads'), { recursive: true })

  // Determine extra deps based on framework choice
  const extraDeps: Record<string, string> = {}
  const frameworkMap: Record<string, string> = { 2: 'astro' }
  const framework = frameworkMap[frameworkChoice]
  if (framework === 'astro') {
    extraDeps.astro = '^5.0.0'
  }

  // package.json
  await writeFile(join(dir, 'package.json'), JSON.stringify({
    name: projectName,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'npx valence dev',
      build: 'npx valence build',
      migrate: 'npx valence migrate',
      start: 'node dist/server.js'
    },
    dependencies: {
      '@valencets/valence': '^0.1.0',
      '@valencets/cms': '^0.1.0',
      '@valencets/db': '^0.1.0',
      ...extraDeps
    },
    devDependencies: {
      typescript: '^5.9.3'
    }
  }, null, 2) + '\n')

  // valence.config.ts
  await writeFile(join(dir, 'valence.config.ts'), `import { defineConfig, collection, field } from '@valencets/valence'

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
    collection({
      slug: 'posts',
      labels: { singular: 'Post', plural: 'Posts' },
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'title' }),
        field.textarea({ name: 'body' }),
        field.boolean({ name: 'published' }),
        field.date({ name: 'publishedAt' })
      ]
    }),

    collection({
      slug: 'users',
      auth: true,
      fields: [
        field.text({ name: 'name', required: true })
      ]
    })
  ],
  admin: {
    pathPrefix: '/admin',
    requireAuth: true
  }
})
`)

  // tsconfig.json
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

  // .env
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

  // .gitignore
  await writeFile(join(dir, '.gitignore'), `node_modules/
dist/
.env
uploads/
*.log
`)

  // README
  await writeFile(join(dir, 'README.md'), `# ${projectName}

Built with [Valence](https://valence.build).

## Development

\`\`\`bash
pnpm dev
\`\`\`

Site: http://localhost:${serverPort}
Admin: http://localhost:${serverPort}/admin
`)

  // First migration
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
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);
`)

  log('Project scaffolded.')

  // Install deps
  if (installDeps) {
    log('Installing dependencies...')
    const pm = detectPackageManager()
    if (!exec(`${pm} install`, dir)) {
      log('Warning: dependency install failed. Run it manually.')
    } else {
      log('Dependencies installed.')
    }
  }

  // Create database
  if (createDb) {
    log(`Creating database "${dbName}"...`)
    if (exec(`createdb ${dbName}`, dir)) {
      log('Database created.')
    } else {
      log('Warning: could not create database. It may already exist or createdb is not in PATH.')
    }
  }

  // Run migrations
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
    } else {
      log('Warning: migrations failed. Run "npx valence migrate" after fixing your database connection.')
    }
  }

  // Init git
  if (initGit) {
    if (exec('git init', dir) && exec('git add -A', dir) && exec('git commit -m "Initial commit from valence init"', dir)) {
      log('Git repository initialized.')
    }
  }

  console.log(`
  Done. Your project is ready.

    cd ${projectName}
    pnpm dev

  Site:  http://localhost:${serverPort}
  Admin: http://localhost:${serverPort}/admin
`)
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

// -- dev --

async function runDev (): Promise<void> {
  const config = loadEnvConfig()
  if (!config) {
    console.error('  Error: missing .env or database configuration. Run from your project root.')
    process.exit(1)
  }

  const port = Number(process.env.PORT ?? 3000)

  // Run migrations first
  log('Running migrations...')
  await runMigrationsForProject(process.cwd(), config)

  // Start HTTP server
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!DOCTYPE html>
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
    <h1><span>v</span>alence</h1>
    <p>Your site is running. Edit <code>valence.config.ts</code> to add collections, then visit the admin panel to start creating content.</p>
    <div class="links">
      <a href="/admin">Admin Panel</a>
      <a href="https://github.com/valencets/valence/wiki">Documentation</a>
    </div>
  </div>
</body>
</html>`)
      return
    }

    if (url.pathname === '/admin') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Valence Admin</title>
<style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family: system-ui, sans-serif; background: #f8fafc; padding: 2rem; }
h1 { margin-bottom: 1rem; } .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
h2 { font-size: 1.1rem; margin-bottom: 0.5rem; } p { color: #64748b; font-size: 0.9rem; }</style>
</head>
<body>
<h1>Admin</h1>
<div class="card"><h2>Posts</h2><p>Manage your blog posts</p></div>
<div class="card"><h2>Users</h2><p>Manage user accounts</p></div>
</body></html>`)
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  })

  server.listen(port, () => {
    console.log(`
  Valence dev server running.

  Site:  http://localhost:${port}
  Admin: http://localhost:${port}/admin

  Press Ctrl+C to stop.
`)
  })
}

// -- build --

async function runBuild (): Promise<void> {
  log('Building for production...')
  const pm = detectPackageManager()
  exec(`${pm} exec tsc`, process.cwd())
  log('Build complete.')
}

// -- helpers --

function detectPackageManager (): string {
  if (existsSync(join(process.cwd(), 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(process.cwd(), 'yarn.lock'))) return 'yarn'
  return 'npm'
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
  // Load .env file manually (no dotenv dependency)
  const envPath = join(process.cwd(), '.env')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8') as string
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
  if (result.isErr()) {
    log(`Migration error: ${result.error.message}`)
    return false
  }

  log(`Applied ${result.value} migration(s).`)
  return true
}
