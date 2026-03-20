import { join } from 'node:path'
import { ResultAsync, fromThrowable } from 'neverthrow'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import type { DbConfig } from '@valencets/db'
import type { CollectionConfig } from '@valencets/cms'
import type { OnServerContext, RouteConfig } from './define-config.js'
import { log } from './cli-utils.js'

let tsxRegistered = false

/**
 * Register tsx as the ESM loader for the current process.
 * This enables .ts imports with .js extensions at runtime,
 * which is required for onServer callbacks that import cross-file .ts modules.
 * Idempotent — safe to call multiple times.
 */
export async function registerTsxLoader (): Promise<void> {
  if (tsxRegistered) return
  const { register } = await import('tsx/esm/api')
  register()
  tsxRegistered = true
}

export interface UserConfig {
  readonly collections: ReadonlyArray<CollectionConfig>
  readonly admin?: {
    readonly requireAuth?: boolean | undefined
  } | undefined
  readonly telemetry?: {
    readonly enabled: boolean
    readonly endpoint: string
    readonly siteId: string
    readonly bufferSize?: number | undefined
    readonly flushIntervalMs?: number | undefined
  } | undefined
  // Preserved from ResolvedValenceConfig so runDev can invoke it.
  readonly onServer?: ((ctx: OnServerContext) => void | Promise<void>) | undefined
  // Preserved from ResolvedValenceConfig — handlers are functions and cannot be
  // serialised through the tsx subprocess, so only populated via direct import.
  readonly routes?: readonly RouteConfig[] | undefined
}

export function loadEnvConfig (): DbConfig | null {
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
  const isDev = process.env.NODE_ENV !== 'production'
  // In dev mode, prefer DB_NAME_DEV if set, otherwise append '_dev' suffix
  const database = isDev
    ? (process.env.DB_NAME_DEV ?? (process.env.DB_NAME ? process.env.DB_NAME + '_dev' : undefined))
    : process.env.DB_NAME
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

export async function loadUserConfig (): Promise<UserConfig | null> {
  const configPath = join(process.cwd(), 'valence.config.ts')
  if (!existsSync(configPath)) {
    log('No valence.config.ts found.')
    return null
  }

  // If running under tsx (TS imports work), load directly
  const directImportResult = await ResultAsync.fromPromise(
    import(configPath),
    () => null
  )

  if (directImportResult.isOk()) {
    const mod = directImportResult.value
    const result = mod.default
    if (result && typeof result.isOk === 'function' && result.isOk()) {
      return {
        collections: result.value?.collections ?? [],
        admin: result.value?.admin,
        telemetry: result.value?.telemetry,
        // onServer and routes are functions/contain functions and can only be
        // preserved via direct import — serialisation through the tsx subprocess would lose them.
        onServer: result.value?.onServer,
        routes: result.value?.routes
      }
    }
    return null
  }

  // Direct import failed (no tsx loader). Try spawning with tsx.
  return loadViaSubprocess(configPath)
}

const safeJsonParseConfig = fromThrowable(JSON.parse, () => null)

async function loadViaSubprocess (configPath: string): Promise<UserConfig | null> {
  const script = [
    `import('${configPath.replace(/\\/g, '/')}')`,
    '.then(m => {',
    '  const r = m.default;',
    '  if (r && r.isOk && r.isOk()) {',
    '    process.stdout.write(JSON.stringify({',
    '      collections: r.value.collections.map(c => ({',
    '        slug: c.slug, labels: c.labels, auth: c.auth, upload: c.upload,',
    '        timestamps: c.timestamps, fields: c.fields',
    '      })),',
    '      admin: r.value.admin,',
    '      telemetry: r.value.telemetry',
    '    }));',
    '  }',
    '})',
    '.catch(e => { process.stderr.write(e.message); process.exit(1); })'
  ].join('')
  const tsxBin = join(process.cwd(), 'node_modules', '.bin', 'tsx')
  const tsxArgs = ['-e', script]

  const safeExecFileSync = fromThrowable(
    () => existsSync(tsxBin)
      ? execFileSync(tsxBin, tsxArgs, { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 }).toString().trim()
      : execFileSync('npx', ['tsx', ...tsxArgs], { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 }).toString().trim(),
    (e) => e
  )

  const execResult = safeExecFileSync()
  if (execResult.isErr()) {
    const e = execResult.error
    log(`Config load via tsx failed: ${e instanceof Error ? e.message : 'unknown'}`)
    return null
  }

  const output = execResult.value
  if (!output) return null

  const parseResult = safeJsonParseConfig(output)
  if (parseResult.isErr() || parseResult.value === null) return null
  const parsed = parseResult.value as { collections: import('@valencets/cms').CollectionConfig[]; admin?: UserConfig['admin']; telemetry?: UserConfig['telemetry'] }

  // Re-hydrate through collection() to get proper CollectionConfig objects.
  // onServer and routes cannot be recovered from the subprocess — functions are not serialisable.
  const { collection: col } = await import('@valencets/cms')
  const collections = parsed.collections.map((c) => col(c))
  return { collections, admin: parsed.admin, telemetry: parsed.telemetry }
}
