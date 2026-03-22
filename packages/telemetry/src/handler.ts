import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import { validateBeaconPayload } from './beacon-validation.js'
import { ingestBeacon } from './ingestion.js'

export interface IngestionHandlerConfig {
  readonly pool: DbPool
}

export function createIngestionHandler (
  config: IngestionHandlerConfig
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { pool } = config

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // Respect Do Not Track header — silently accept but skip storage
    if (req.headers['dnt'] === '1') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, ingested: 0 }))
      return
    }

    const body = await readRequestBody(req)

    const validated = validateBeaconPayload(body)
    if (validated.isErr()) {
      // Silent accept: always return 200 to prevent client retries.
      // Bad data goes to audit, not to error responses.
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, ingested: 0 }))
      return
    }

    const events = validated.value
    if (events.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, ingested: 0 }))
      return
    }

    const result = await ingestBeacon(pool, events)
    result.match(
      (ingestResult) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, ingested: ingestResult.eventsInserted }))
      },
      () => {
        // Silent accept on DB errors too.
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, ingested: 0 }))
      }
    )
  }
}

function readRequestBody (req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    req.on('end', () => { resolve(Buffer.concat(chunks).toString()) })
  })
}
