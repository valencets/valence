import { describe, it, expect } from 'vitest'
import { checkAuth } from '../server/auth-middleware.js'
import { renderHudPage } from '../templates/hud-page.js'

describe('checkAuth', () => {
  it('returns ok for valid bearer token', () => {
    const result = checkAuth('Bearer test-token-123', 'test-token-123')
    expect(result.isOk()).toBe(true)
  })

  it('returns err for missing authorization', () => {
    const result = checkAuth(undefined, 'test-token-123')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('AUTH_FAILED')
  })

  it('returns err for wrong token', () => {
    const result = checkAuth('Bearer wrong-token', 'test-token-123')
    expect(result.isErr()).toBe(true)
  })

  it('returns err for non-bearer scheme', () => {
    const result = checkAuth('Basic dXNlcjpwYXNz', 'test-token-123')
    expect(result.isErr()).toBe(true)
  })

  it('returns err for empty token', () => {
    const result = checkAuth('Bearer ', 'test-token-123')
    expect(result.isErr()).toBe(true)
  })
})

describe('renderHudPage', () => {
  it('returns HTML with hud-client-dashboard', () => {
    const html = renderHudPage(false)
    expect(html).toContain('hud-client-dashboard')
  })

  it('renders diagnostic dashboard when diagnostics flag is true', () => {
    const html = renderHudPage(true)
    expect(html).toContain('hud-diagnostic-dashboard')
  })

  it('includes summary API endpoints as data attributes', () => {
    const html = renderHudPage(false)
    expect(html).toContain('/api/summaries/sessions')
    expect(html).toContain('/api/summaries/events')
  })
})
