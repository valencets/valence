import type { DbError, DbPool } from '@valencets/db'
import type { ResultAsync } from '@valencets/resultkit'
import type { BeaconEvent } from './beacon-types.js'
import { createSession } from './event-queries.js'
import { insertEvents } from './event-queries.js'

export interface IngestResult {
  readonly eventsInserted: number
  readonly sessionId: string
}

export function ingestBeacon (
  pool: DbPool,
  events: ReadonlyArray<BeaconEvent>
): ResultAsync<IngestResult, DbError> {
  const firstEvent = events[0]!

  return createSession(pool, {
    device_type: 'beacon',
    referrer: firstEvent.referrer,
    operating_system: firstEvent.business_type
  }).andThen((session) => {
    const insertable = events.map((e) => ({
      session_id: session.session_id,
      event_category: e.type,
      dom_target: e.targetDOMNode,
      payload: {
        path: e.path,
        x_coord: e.x_coord,
        y_coord: e.y_coord,
        site_id: e.site_id,
        schema_version: e.schema_version,
        business_type: e.business_type,
        beacon_id: e.id,
        beacon_timestamp: e.timestamp
      }
    }))

    return insertEvents(pool, insertable).map((count) => ({
      eventsInserted: count,
      sessionId: session.session_id
    }))
  })
}
