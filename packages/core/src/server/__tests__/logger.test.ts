import { describe, it, expect, vi } from 'vitest'
import { createLogger, parseLogLevel, LogLevel } from '../logger.js'
import type { LogLevel as LogLevelType } from '../logger.js'

interface Captured {
  readonly level: LogLevelType
  readonly line: string
  readonly record: Record<string, unknown>
}

function capturingLogger (options?: { level?: LogLevelType, base?: Record<string, string | number | boolean | null> }): {
  logger: ReturnType<typeof createLogger>
  captured: Captured[]
} {
  const captured: Captured[] = []
  const logger = createLogger({
    level: options?.level ?? LogLevel.DEBUG,
    ...(options?.base !== undefined ? { base: options.base } : {}),
    now: () => '2026-07-10T00:00:00.000Z',
    sink: (level, line) => {
      captured.push({ level, line, record: JSON.parse(line) as Record<string, unknown> })
    }
  })
  return { logger, captured }
}

describe('LogLevel', () => {
  it('is a frozen const map', () => {
    expect(Object.isFrozen(LogLevel)).toBe(true)
    expect(LogLevel.DEBUG).toBe('debug')
    expect(LogLevel.INFO).toBe('info')
    expect(LogLevel.WARN).toBe('warn')
    expect(LogLevel.ERROR).toBe('error')
  })
})

describe('createLogger', () => {
  it('emits a single JSON line with level, time, and msg', () => {
    const { logger, captured } = capturingLogger()
    logger.info('server started')

    expect(captured).toHaveLength(1)
    expect(captured[0]?.line).not.toContain('\n')
    expect(captured[0]?.record).toEqual({
      level: 'info',
      time: '2026-07-10T00:00:00.000Z',
      msg: 'server started'
    })
    expect(captured[0]?.level).toBe('info')
  })

  it('merges structured fields after the reserved keys', () => {
    const { logger, captured } = capturingLogger()
    logger.warn('slow query', { durationMs: 1234, table: 'posts', cached: false })

    expect(captured[0]?.record).toEqual({
      level: 'warn',
      time: '2026-07-10T00:00:00.000Z',
      msg: 'slow query',
      durationMs: 1234,
      table: 'posts',
      cached: false
    })
  })

  it('omits fields whose value is undefined', () => {
    const { logger, captured } = capturingLogger()
    logger.info('partial', { present: 'yes', missing: undefined })

    expect(captured[0]?.record).toEqual({
      level: 'info',
      time: '2026-07-10T00:00:00.000Z',
      msg: 'partial',
      present: 'yes'
    })
    expect(Object.keys(captured[0]?.record ?? {})).not.toContain('missing')
  })

  it('routes each call to the sink tagged with its level', () => {
    const { logger, captured } = capturingLogger()
    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')

    expect(captured.map(c => c.level)).toEqual(['debug', 'info', 'warn', 'error'])
  })

  it('suppresses calls below the configured threshold', () => {
    const { logger, captured } = capturingLogger({ level: LogLevel.WARN })
    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')

    expect(captured.map(c => c.level)).toEqual(['warn', 'error'])
  })

  it('defaults the threshold to info', () => {
    const captured: string[] = []
    const logger = createLogger({ sink: (_l, line) => captured.push(line) })
    logger.debug('hidden')
    logger.info('shown')

    expect(captured).toHaveLength(1)
    expect(captured[0]).toContain('shown')
  })

  it('exposes the resolved level', () => {
    expect(createLogger({ level: LogLevel.ERROR }).level).toBe('error')
    expect(createLogger().level).toBe('info')
  })

  it('escapes newlines in the message so one call is one line', () => {
    const { logger, captured } = capturingLogger()
    logger.error('line one\nline two\r\nthree')

    expect(captured).toHaveLength(1)
    expect(captured[0]?.line.split('\n')).toHaveLength(1)
    expect(captured[0]?.record.msg).toBe('line one\nline two\r\nthree')
  })

  it('carries base fields on every line', () => {
    const { logger, captured } = capturingLogger({ base: { service: 'valence' } })
    logger.info('a')
    logger.info('b', { extra: 1 })

    expect(captured[0]?.record).toMatchObject({ service: 'valence', msg: 'a' })
    expect(captured[1]?.record).toMatchObject({ service: 'valence', msg: 'b', extra: 1 })
  })

  it('child() inherits base fields and the sink, adding its own bindings', () => {
    const { logger, captured } = capturingLogger({ base: { service: 'valence' } })
    const child = logger.child({ requestId: 'abc-123' })
    child.info('request')

    expect(captured[0]?.record).toEqual({
      level: 'info',
      time: '2026-07-10T00:00:00.000Z',
      msg: 'request',
      service: 'valence',
      requestId: 'abc-123'
    })
  })

  it('per-call fields override base and child bindings', () => {
    const { logger, captured } = capturingLogger({ base: { scope: 'base' } })
    const child = logger.child({ scope: 'child' })
    child.info('override', { scope: 'call' })

    expect(captured[0]?.record.scope).toBe('call')
  })

  it('never lets a caller clobber the reserved level/time/msg keys', () => {
    const { logger, captured } = capturingLogger()
    logger.info('real', { level: 'fake', time: 'fake', msg: 'fake' })

    expect(captured[0]?.record).toEqual({
      level: 'info',
      time: '2026-07-10T00:00:00.000Z',
      msg: 'real'
    })
  })

  it('defaults to a console-backed sink when none is provided', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const logger = createLogger({ level: LogLevel.DEBUG, now: () => 'T' })

    logger.info('to stdout')
    logger.error('to stderr')

    expect(spy).toHaveBeenCalledWith('{"level":"info","time":"T","msg":"to stdout"}\n')
    expect(errSpy).toHaveBeenCalledWith('{"level":"error","time":"T","msg":"to stderr"}\n')
    spy.mockRestore()
    errSpy.mockRestore()
  })
})

describe('parseLogLevel', () => {
  it('accepts the four known levels case-insensitively', () => {
    expect(parseLogLevel('debug')).toBe('debug')
    expect(parseLogLevel('INFO')).toBe('info')
    expect(parseLogLevel('Warn')).toBe('warn')
    expect(parseLogLevel('error')).toBe('error')
  })

  it('falls back to info for unknown or missing input', () => {
    expect(parseLogLevel(undefined)).toBe('info')
    expect(parseLogLevel('')).toBe('info')
    expect(parseLogLevel('trace')).toBe('info')
  })
})
