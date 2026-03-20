import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import type { DbConfig } from '@valencets/db'
import type { CollectionConfig } from '@valencets/cms'
import type { OnServerContext } from './define-config.js'
import { log } from './cli-utils.js'

export interface UserConfig {
  readonly collections: ReadonlyArray<CollectionConfig>
  readonly telemetry?: {
    readonly enabled: boolean
    readonly endpoint: string
    readonly siteId: string
    readonly bufferSize?: number | undefined
    readonly flushIntervalMs?: number | undefined
  } | undefined
  // Preserved from ResolvedValenceConfig so runDev can invoke it.
  readonly onServer?: ((ctx: OnServerContext) => void | Promise<void>) | undefined
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
  try {
    const mod = await import(configPath)
    const result = mod.default
    if (result && typeof result.isOk === 'function' && result.isOk()) {
      return {
        collections: result.value.collections ?? [],
        telemetry: result.value.telemetry,
        // onServer is a function and can only be preserved via direct import —
        // serialisation through the tsx subprocess would lose it.
        onServer: result.value.onServer
      }
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
        '    process.stdout.write(JSON.stringify({',
        '      collections: r.value.collections.map(c => ({',
        '        slug: c.slug, labels: c.labels, auth: c.auth, upload: c.upload,',
        '        timestamps: c.timestamps, fields: c.fields',
        '      })),',
        '      telemetry: r.value.telemetry',
        '    }));',
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
        // Re-hydrate through collection() to get proper CollectionConfig objects.
        // onServer cannot be recovered from the subprocess — functions are not serialisable.
        const { collection: col } = await import('@valencets/cms')
        const collections = parsed.collections.map((c: Parameters<typeof col>[0]) => col(c))
        return { collections, telemetry: parsed.telemetry }
      }
    } catch (e2) {
      log(`Config load via tsx failed: ${e2 instanceof Error ? e2.message : 'unknown'}`)
    }
    return null
  }
}
