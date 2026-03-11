import { describe, it, expect, vi } from 'vitest'
import { ok, err } from 'neverthrow'
import { createIngestionHandler } from '../black-hole.js'
import type { AuditFn, AuditEntry } from '../black-hole.js'
import type { PersistFn } from '../pipeline.js'
import type { ValidatedTelemetryPayload } from '../schemas.js'

function makeValidPayloadJson (count: number = 1): string {
  const intents = Array.from({ length: count }, (_, i) => ({
    id: `evt-${i}`,
    timestamp: 1710000000000 + i,
    type: 'CLICK',
    targetDOMNode: `#btn-${i}`,
    x_coord: 100 + i,
    y_coord: 200 + i
  }))
  return JSON.stringify(intents)
}

const stubPersist: PersistFn = (payload: ValidatedTelemetryPayload) =>
  ok(payload.length)

const failPersist: PersistFn = () =>
  err({ code: 'PERSIST_FAILURE', message: 'Connection refused' })

const noopAudit: AuditFn = () => {}

describe('createIngestionHandler', () => {
  describe('Black Hole invariant — always returns 200', () => {
    it('returns 200 for valid payload', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const response = handler(makeValidPayloadJson())
      expect(response.status).toBe(200)
    })

    it('returns 200 for malformed JSON', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const response = handler('{bad json')
      expect(response.status).toBe(200)
    })

    it('returns 200 for invalid schema', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const response = handler('{"not":"an array"}')
      expect(response.status).toBe(200)
    })

    it('returns 200 for empty string', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const response = handler('')
      expect(response.status).toBe(200)
    })

    it('returns 200 for persist failure', () => {
      const handler = createIngestionHandler(failPersist, noopAudit)
      const response = handler(makeValidPayloadJson())
      expect(response.status).toBe(200)
    })
  })

  describe('success response', () => {
    it('body contains ok: true and persisted count', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const response = handler(makeValidPayloadJson(3))
      const body = JSON.parse(response.body)
      expect(body.ok).toBe(true)
      expect(body.persisted).toBe(3)
    })

    it('persisted count matches intent count', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const r1 = handler(makeValidPayloadJson(1))
      const r2 = handler(makeValidPayloadJson(7))
      expect(JSON.parse(r1.body).persisted).toBe(1)
      expect(JSON.parse(r2.body).persisted).toBe(7)
    })

    it('empty array returns persisted: 0', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const response = handler('[]')
      const body = JSON.parse(response.body)
      expect(body.ok).toBe(true)
      expect(body.persisted).toBe(0)
    })
  })

  describe('error response — no details leaked', () => {
    it('body contains ok: true on parse failure', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const response = handler('{bad')
      const body = JSON.parse(response.body)
      expect(body.ok).toBe(true)
    })

    it('body does not contain persisted on error', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const response = handler('{bad')
      const body = JSON.parse(response.body)
      expect(body).not.toHaveProperty('persisted')
    })

    it('body does not contain error details', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const response = handler('{bad')
      const body = JSON.parse(response.body)
      expect(body).not.toHaveProperty('code')
      expect(body).not.toHaveProperty('message')
      expect(body).not.toHaveProperty('raw')
      expect(body).not.toHaveProperty('issues')
    })
  })

  describe('audit — error logging', () => {
    it('audit is NOT called on success', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(stubPersist, spy)
      handler(makeValidPayloadJson())
      expect(spy).not.toHaveBeenCalled()
    })

    it('audit is called once on parse failure', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(stubPersist, spy)
      handler('{bad')
      expect(spy).toHaveBeenCalledOnce()
    })

    it('audit is called once on validation failure', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(stubPersist, spy)
      handler('"not an array"')
      expect(spy).toHaveBeenCalledOnce()
    })

    it('audit is called once on persist failure', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(failPersist, spy)
      handler(makeValidPayloadJson())
      expect(spy).toHaveBeenCalledOnce()
    })

    it('audit entry has correct code for parse failure', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(stubPersist, spy)
      handler('{bad')
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.code).toBe('PARSE_FAILURE')
    })

    it('audit entry has correct code for validation failure', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(stubPersist, spy)
      handler('{"not":"array"}')
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.code).toBe('VALIDATION_FAILURE')
    })

    it('audit entry has correct code for persist failure', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(failPersist, spy)
      handler(makeValidPayloadJson())
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.code).toBe('PERSIST_FAILURE')
    })

    it('audit entry has non-empty message', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(stubPersist, spy)
      handler('{bad')
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.message.length).toBeGreaterThan(0)
    })

    it('audit entry has timestamp', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(stubPersist, spy)
      const before = Date.now()
      handler('{bad')
      const after = Date.now()
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.timestamp).toBeGreaterThanOrEqual(before)
      expect(entry.timestamp).toBeLessThanOrEqual(after)
    })

    it('audit entry has raw field for parse failure', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(stubPersist, spy)
      const raw = '{malformed input'
      handler(raw)
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.raw).toBe(raw)
    })

    it('audit entry has undefined raw for non-parse failures', () => {
      const spy = vi.fn()
      const handler = createIngestionHandler(failPersist, spy)
      handler(makeValidPayloadJson())
      const entry: AuditEntry = spy.mock.calls[0]![0]
      expect(entry.raw).toBeUndefined()
    })
  })

  describe('integration', () => {
    it('full round-trip: valid JSON → persisted count', () => {
      const persisted: number[] = []
      const trackingPersist: PersistFn = (payload) => {
        persisted.push(payload.length)
        return ok(payload.length)
      }
      const handler = createIngestionHandler(trackingPersist, noopAudit)
      const response = handler(makeValidPayloadJson(5))
      expect(response.status).toBe(200)
      expect(JSON.parse(response.body).persisted).toBe(5)
      expect(persisted).toEqual([5])
    })

    it('sequential calls are independent', () => {
      const handler = createIngestionHandler(stubPersist, noopAudit)
      const r1 = handler(makeValidPayloadJson(2))
      const r2 = handler('{bad')
      const r3 = handler(makeValidPayloadJson(4))
      expect(JSON.parse(r1.body).persisted).toBe(2)
      expect(JSON.parse(r2.body)).toEqual({ ok: true })
      expect(JSON.parse(r3.body).persisted).toBe(4)
    })
  })
})
