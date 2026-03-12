#!/usr/bin/env tsx
// Standalone script for systemd timer:
// 1. Generate daily summary from local summary tables
// 2. Push unsynced summaries to studio endpoint

import { createPool, closePool, generateDailySummary, getUnsyncedDailySummaries, markSynced } from '@inertia/db'
import type { DbConfig } from '@inertia/db'
import { pushDailySummary } from '../features/admin/server/push-client.js'
import type { PushConfig } from '../features/admin/server/push-client.js'

const dbConfig: DbConfig = {
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number(process.env['DB_PORT'] ?? 5432),
  database: process.env['DB_NAME'] ?? 'inertia_studio',
  username: process.env['DB_USER'] ?? 'inertia_app',
  password: process.env['DB_PASSWORD'] ?? 'changeme',
  max: 5,
  idle_timeout: 10,
  connect_timeout: 5
}

const siteId = process.env['SITE_ID'] ?? 'studio'
const businessType = process.env['BUSINESS_TYPE'] ?? 'other'
const siteSecret = process.env['SITE_SECRET'] ?? ''
const studioEndpoint = process.env['STUDIO_ENDPOINT'] ?? ''

const pushConfig: PushConfig = {
  studioEndpoint,
  siteSecret
}

async function run (): Promise<void> {
  const pool = createPool(dbConfig)
  const today = new Date()

  // Step 1: Generate today's daily summary
  const genResult = await generateDailySummary(pool, siteId, businessType, today)
  if (genResult.isErr()) {
    console.error(`[aggregate] Failed to generate daily summary: ${genResult.error.message}`)
    await closePool(pool)
    process.exit(1)
  }
  console.log(`[aggregate] Generated daily summary for ${siteId} on ${today.toISOString().slice(0, 10)}`)

  // Step 2: Push unsynced summaries
  if (studioEndpoint.length === 0 || siteSecret.length === 0) {
    console.log('[aggregate] No STUDIO_ENDPOINT or SITE_SECRET configured, skipping push')
    await closePool(pool)
    return
  }

  const unsyncedResult = await getUnsyncedDailySummaries(pool, siteId)
  if (unsyncedResult.isErr()) {
    console.error(`[aggregate] Failed to get unsynced summaries: ${unsyncedResult.error.message}`)
    await closePool(pool)
    process.exit(1)
  }

  const unsynced = unsyncedResult.value
  console.log(`[aggregate] Found ${unsynced.length} unsynced summaries`)

  for (const summary of unsynced) {
    const pushResult = await pushDailySummary(pushConfig, summary)
    if (pushResult.isOk()) {
      await markSynced(pool, summary.id)
      console.log(`[aggregate] Pushed and marked synced: ${summary.date}`)
    } else {
      console.error(`[aggregate] Failed to push summary for ${summary.date}: ${pushResult.error.message}`)
    }
  }

  await closePool(pool)
  console.log('[aggregate] Done')
}

run()
