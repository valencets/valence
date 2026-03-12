import { describe, it, expect } from 'vitest'
import { DbErrorCode } from '../types.js'
import type { DbError, SessionRow, EventRow, InsertableSession, InsertableEvent, DbConfig } from '../types.js'

describe('DbErrorCode', () => {
  it('has CONNECTION_FAILED code', () => {
    expect(DbErrorCode.CONNECTION_FAILED).toBe('CONNECTION_FAILED')
  })

  it('has QUERY_FAILED code', () => {
    expect(DbErrorCode.QUERY_FAILED).toBe('QUERY_FAILED')
  })

  it('has MIGRATION_FAILED code', () => {
    expect(DbErrorCode.MIGRATION_FAILED).toBe('MIGRATION_FAILED')
  })

  it('has INVALID_CONFIG code', () => {
    expect(DbErrorCode.INVALID_CONFIG).toBe('INVALID_CONFIG')
  })

  it('has CONSTRAINT_VIOLATION code', () => {
    expect(DbErrorCode.CONSTRAINT_VIOLATION).toBe('CONSTRAINT_VIOLATION')
  })

  it('has NO_ROWS code', () => {
    expect(DbErrorCode.NO_ROWS).toBe('NO_ROWS')
  })

  it('all codes are unique string literals', () => {
    const values = Object.values(DbErrorCode)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('dictionary map lookup works for each code', () => {
    const codeMap: Record<string, boolean> = {}
    for (const code of Object.values(DbErrorCode)) {
      codeMap[code] = true
    }
    expect(codeMap[DbErrorCode.CONNECTION_FAILED]).toBe(true)
    expect(codeMap[DbErrorCode.QUERY_FAILED]).toBe(true)
    expect(codeMap[DbErrorCode.MIGRATION_FAILED]).toBe(true)
    expect(codeMap[DbErrorCode.INVALID_CONFIG]).toBe(true)
    expect(codeMap[DbErrorCode.CONSTRAINT_VIOLATION]).toBe(true)
  })
})

describe('type construction', () => {
  it('DbError can be constructed', () => {
    const error: DbError = { code: DbErrorCode.CONNECTION_FAILED, message: 'refused' }
    expect(error.code).toBe('CONNECTION_FAILED')
    expect(error.message).toBe('refused')
  })

  it('SessionRow can be constructed', () => {
    const row: SessionRow = {
      session_id: 'abc-123',
      created_at: new Date('2026-01-01'),
      referrer: 'https://example.com',
      device_type: 'desktop',
      operating_system: 'Linux'
    }
    expect(row.session_id).toBe('abc-123')
    expect(row.device_type).toBe('desktop')
  })

  it('SessionRow allows null referrer and os', () => {
    const row: SessionRow = {
      session_id: 'abc-123',
      created_at: new Date(),
      referrer: null,
      device_type: 'mobile',
      operating_system: null
    }
    expect(row.referrer).toBeNull()
    expect(row.operating_system).toBeNull()
  })

  it('EventRow can be constructed', () => {
    const row: EventRow = {
      event_id: 1,
      session_id: 'abc-123',
      created_at: new Date(),
      event_category: 'CLICK',
      dom_target: '#btn',
      payload: { action: 'submit' }
    }
    expect(row.event_id).toBe(1)
    expect(row.event_category).toBe('CLICK')
  })

  it('InsertableSession can be constructed', () => {
    const session: InsertableSession = {
      referrer: null,
      device_type: 'tablet',
      operating_system: 'iOS'
    }
    expect(session.device_type).toBe('tablet')
  })

  it('InsertableEvent can be constructed', () => {
    const event: InsertableEvent = {
      session_id: 'abc-123',
      event_category: 'SCROLL',
      dom_target: null,
      payload: {}
    }
    expect(event.session_id).toBe('abc-123')
    expect(event.dom_target).toBeNull()
  })

  it('DbConfig can be constructed', () => {
    const config: DbConfig = {
      host: 'localhost',
      port: 5432,
      database: 'inertia',
      username: 'app',
      password: 'secret',
      max: 10,
      idle_timeout: 30,
      connect_timeout: 5
    }
    expect(config.port).toBe(5432)
    expect(config.max).toBe(10)
  })
})
