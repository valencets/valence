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

// #349 audit — sendBeacon payloads are tiny (browsers cap around 64 KB);
// anything past this is hostile. At the cap the promise settles
// immediately with an empty body — downstream validation fails it into the
// silent-accept 200 path and nothing buffers past the limit.
const MAX_BEACON_BYTES = 256 * 1024

function readRequestBody (req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let total = 0
    let settled = false
    const settle = (body: string): void => {
      if (settled) return
      settled = true
      resolve(body)
    }
    req.on('data', (chunk: Buffer) => {
      if (settled) return
      total += chunk.length
      if (total > MAX_BEACON_BYTES) {
        chunks.length = 0
        settle('')
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => { settle(Buffer.concat(chunks).toString()) })
  })
}
