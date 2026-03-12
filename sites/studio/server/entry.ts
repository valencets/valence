import { createServer } from 'node:http'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { createPool, closePool, loadMigrations, runMigrations } from '@inertia/db'
import type { DbPool } from '@inertia/db'
import { loadConfig } from './config.js'
import { createRouter } from './router.js'
import type { RouteContext } from './types.js'
import { applySecurityHeaders, tryServeStatic } from './middleware.js'
import { registerRoutes } from './register-routes.js'
import { getStudioCSS } from '../features/theme/config/studio-css.js'
import { bundleClientJS, bundleAdminJS } from '../features/client/bundle-client.js'
import { startAggregationCron } from '../features/admin/server/aggregation-cron.js'
import { seedDemoSummaries } from '@inertia/db/seed'

const config = loadConfig()

let pool: DbPool | null = null
let cronHandle: { stop: () => void } | null = null

async function boot (): Promise<void> {
  // Init DB pool
  pool = createPool(config.db)

  // Run migrations
  const migrationsDir = join(import.meta.dirname ?? '.', '..', '..', '..', '..', 'packages', 'db', 'migrations')
  const migrationsResult = await loadMigrations(migrationsDir)

  if (migrationsResult.isOk()) {
    const runResult = await runMigrations(pool, migrationsResult.value)
    runResult.match(
      (count) => {
        if (count > 0) {
          console.log(`Applied ${count} migration(s)`)
        }
      },
      (dbErr) => console.error('Migration error:', dbErr.message)
    )
  } else {
    console.error('Failed to load migrations:', migrationsResult.error.message)
  }

  // Start aggregation cron
  cronHandle = startAggregationCron(pool)
  console.log('Aggregation cron started')

  // Seed demo data if enabled
  if (process.env['DEMO_DATA'] === '1') {
    const seedResult = await seedDemoSummaries(pool)
    seedResult.match(
      () => console.log('Seeded demo summary data'),
      (err) => console.error('Demo seed error:', err.message)
    )
  }

  // Generate CSS to public directory
  const publicCSS = join(import.meta.dirname ?? '.', '..', '..', 'public', 'css')
  await mkdir(publicCSS, { recursive: true })
  await writeFile(join(publicCSS, 'studio.css'), getStudioCSS())
  console.log('Generated public/css/studio.css')

  // Generate client JS bundles
  const studioRoot = join(import.meta.dirname ?? '.', '..', '..')
  const publicJS = join(studioRoot, 'public', 'js')
  await mkdir(publicJS, { recursive: true })
  await bundleClientJS(studioRoot)
  console.log('Generated public/js/boot.js')
  await bundleAdminJS(studioRoot)
  console.log('Generated public/js/admin.js')

  // Build router
  const router = createRouter()
  const ctx: RouteContext = { pool, config }

  registerRoutes(router)

  // HTTP server
  const server = createServer(async (req, res) => {
    applySecurityHeaders(res)

    // Try static files first
    const served = await tryServeStatic(req, res)
    if (served) return

    await router.handle(req, res, ctx)
  })

  server.listen(config.port, config.host, () => {
    console.log(`Studio server listening on http://${config.host}:${config.port}`)
  })

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('Shutting down...')
    if (cronHandle) cronHandle.stop()
    server.close()
    if (pool) {
      await closePool(pool)
    }
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

boot().catch((e) => {
  console.error('Fatal boot error:', e)
  process.exit(1)
})
