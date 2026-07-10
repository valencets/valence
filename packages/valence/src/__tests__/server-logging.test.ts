import { describe, it, expect, vi } from 'vitest'
import { buildRequestLogger } from '../server-logging.js'

describe('buildRequestLogger', () => {
  it('honors an explicit level string', () => {
    expect(buildRequestLogger('debug').level).toBe('debug')
    expect(buildRequestLogger('error').level).toBe('error')
  })

  it('defaults to info when the level is missing', () => {
    expect(buildRequestLogger(undefined).level).toBe('info')
  })

  it('defaults to info when the level is unrecognized', () => {
    expect(buildRequestLogger('verbose').level).toBe('info')
  })

  it('tags every line with the valence service so multi-process logs stay attributable', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    buildRequestLogger('info').info('boot')

    const line = spy.mock.calls[0]?.[0]
    expect(typeof line).toBe('string')
    expect(JSON.parse(String(line))).toMatchObject({ service: 'valence', msg: 'boot' })
    spy.mockRestore()
  })
})
