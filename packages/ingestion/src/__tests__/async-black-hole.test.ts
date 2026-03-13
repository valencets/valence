import { describe, it, expect, vi } from 'vitest'
import { okAsync, errAsync } from '@inertia/neverthrow'
import { createAsyncIngestionHandler } from '../black-hole.js'
import type { AuditFn, AuditEntry } from '../black-hole.js'
import type { AsyncPersistFn } from '../pipeline.js'
import type { ValidatedTelemetryPayload } from '../schemas.js'

function makeValidPayloadJson (count: number = 1): string {
  const intents = Array.from({ length: count }, (_, i) => ({
    id: `evt-${i}`,
    timestamp: 1710000000000 + i,
    type: 'CLICK',
    targetDOMNode: `#btn-${i}`,
    x_coord: 100 + i,
    y_coord: 200 + i,
    schema_version: 1
  }))
  return JSON.stringify(intents)
}

const stubAsyncPersist: AsyncPersistFn = (payload: ValidatedTelemetryPayload) =>
  okAsync(payload.length)

const failAsyncPersist: AsyncPersistFn = () =>
  errAsync({ code: 'PERSIST_FAILURE', message: 'Connection refused' })

const noopAudit: AuditFn = () => {}

describe('createAsyncIngestionHandler', () => {
  describe('Black Hole invariant — always returns 200', () => {
    it('returns 200 for valid payload', async () => {
      const handler = createAsyncIngestionHandler(stubAsyncPersist, noopAudit)
      const response = await handler(makeValidPayloadJson())
      expect(response.status).toBe(200)
    })

    it('returns 200 for malformed JSON', async () => {
      const handler = createAsyncIngestionHandler(stubAsyncPersist, noopAudit)
      const response = await handler('{bad json')
      expect(response.status).toBe(200)
    })

    it('returns 200 for invalid schema', async () => {
      const handler = createAsyncIngestionHandler(stubAsyncPersist, noopAudit)
      const response = await handler('{"not":"an array"}')
      expect(response.status).toBe(200)
    })

    it('returns 200 for persist failure', async () => {
      const handler = createAsyncIngestionHandler(failAsyncPersist, noopAudit)
      const response = await handler(makeValidPayloadJson())
      expect(response.status).toBe(200)
    })
  })

  describe('success response', () => {
    it('body contains ok: true and persisted count', async () => {
      const handler = createAsyncIngestionHandler(stubAsyncPersist, noopAudit)
      const response = await handler(makeValidPayloadJson(3))
      const body = JSON.parse(response.body)
      expect(body.ok).toBe(true)
      expect(body.persisted).toBe(3)
    })

    it('empty array returns persisted: 0', async () => {
      const handler = createAsyncIngestionHandler(stubAsyncPersist, noopAudit)
      const response = await handler('[]')
      const body = JSON.parse(response.body)
      expect(body.ok).toBe(true)
      expect(body.persisted).toBe(0)
    })
  })

  describe('error response — no details leaked', () => {
    it('body contains ok: true on parse failure', async () => {
      const handler = createAsyncIngestionHandler(stubAsyncPersist, noopAudit)
      const response = await handler('{bad')
      const body = JSON.parse(response.body)
      expect(body.ok).toBe(true)
    })

    it('body does not contain persisted on error', async () => {
      const handler = createAsyncIngestionHandler(stubAsyncPersist, noopAudit)
      const response = await handler('{bad')
      const body = JSON.parse(response.body)
      expect(body).not.toHaveProperty('persisted')
    })

    it('body does not contain error details', async () => {
      const handler = createAsyncIngestionHandler(stubAsyncPersist, noopAudit)
      const response = await handler('{bad')
      const body = JSON.parse(response.body)
      expect(body).not.toHaveProperty('code')
      expect(body).not.toHaveProperty('message')
      expect(body).not.toHaveProperty('raw')
    })
  })

  describe('audit — error logging', () => {
    it('audit is NOT called on success', async () => {
      const spy = vi.fn()
      const handler = createAsyncIngestionHandler(stubAsyncPersist, spy)
      await handler(makeValidPayloadJson())
      expect(spy).not.toHaveBeenCalled()
    })

    it('audit is called once on parse failure', async () => {
      const spy = vi.fn()
      const handler = createAsyncIngestionHandler(stubAsyncPersist, spy)
      await handler('{bad')
      expect(spy).toHaveBeenCalledOnce()
    })

    it('audit is called once on persist failure', async () => {
      const spy = vi.fn()
      const handler = createAsyncIngestionHandler(failAsyncPersist, spy)
      await handler(makeValidPayloadJson())
      expect(spy).toHaveBeenCalledOnce()
    })

    it('audit entry has correct code for parse failure', async () => {
      const spy = vi.fn()
      const handler = createAsyncIngestionHandler(stubAsyncPersist, spy)
      await handler('{bad')
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.code).toBe('PARSE_FAILURE')
    })

    it('audit entry has correct code for persist failure', async () => {
      const spy = vi.fn()
      const handler = createAsyncIngestionHandler(failAsyncPersist, spy)
      await handler(makeValidPayloadJson())
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.code).toBe('PERSIST_FAILURE')
    })

    it('audit entry has raw field for parse failure', async () => {
      const spy = vi.fn()
      const handler = createAsyncIngestionHandler(stubAsyncPersist, spy)
      const raw = '{malformed input'
      await handler(raw)
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.raw).toBe(raw)
    })

    it('audit entry has undefined raw for non-parse failures', async () => {
      const spy = vi.fn()
      const handler = createAsyncIngestionHandler(failAsyncPersist, spy)
      await handler(makeValidPayloadJson())
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.raw).toBeUndefined()
    })
  })

  describe('integration', () => {
    it('full round-trip: valid JSON → persisted count', async () => {
      const persisted: number[] = []
      const trackingPersist: AsyncPersistFn = (payload) => {
        persisted.push(payload.length)
        return okAsync(payload.length)
      }
      const handler = createAsyncIngestionHandler(trackingPersist, noopAudit)
      const response = await handler(makeValidPayloadJson(5))
      expect(response.status).toBe(200)
      expect(JSON.parse(response.body).persisted).toBe(5)
      expect(persisted).toEqual([5])
    })

    it('sequential calls are independent', async () => {
      const handler = createAsyncIngestionHandler(stubAsyncPersist, noopAudit)
      const r1 = await handler(makeValidPayloadJson(2))
      const r2 = await handler('{bad')
      const r3 = await handler(makeValidPayloadJson(4))
      expect(JSON.parse(r1.body).persisted).toBe(2)
      expect(JSON.parse(r2.body)).toEqual({ ok: true })
      expect(JSON.parse(r3.body).persisted).toBe(4)
    })
  })
})
