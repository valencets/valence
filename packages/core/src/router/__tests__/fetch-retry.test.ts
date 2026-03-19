import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAbortableFetch } from '../fetch-retry.js'

describe('createAbortableFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('successful fetch passes through', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('ok', { status: 200 })
    )
    const handle = createAbortableFetch(mockFetch)
    const response = await handle.fetch('/page')
    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('calling fetch() aborts previous in-flight fetch', async () => {
    let callCount = 0
    const mockFetch = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      callCount++
      if (callCount === 1) {
        // First call: hang until aborted
        return new Promise((_resolve, reject) => {
          if (init?.signal !== undefined) {
            init.signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            })
          }
        })
      }
      // Second call: resolve immediately
      return Promise.resolve(new Response('second', { status: 200 }))
    })

    const handle = createAbortableFetch(mockFetch)
    const firstPromise = handle.fetch('/page-a')
    const secondPromise = handle.fetch('/page-b')

    const secondResponse = await secondPromise
    expect(secondResponse.status).toBe(200)
    await expect(firstPromise).rejects.toSatisfy(
      (e: DOMException) => e.name === 'AbortError'
    )
  })

  it('network error triggers immediate retry (2 total fetches)', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    const handle = createAbortableFetch(mockFetch)
    const responsePromise = handle.fetch('/page')

    // First retry is immediate — no timer needed
    const response = await responsePromise
    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('after 2 failures, waits 1s then retries (3 total fetches)', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    const handle = createAbortableFetch(mockFetch)
    const responsePromise = handle.fetch('/page')

    // First retry is immediate
    await vi.advanceTimersByTimeAsync(0)
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Second retry waits 1000ms
    await vi.advanceTimersByTimeAsync(1000)

    const response = await responsePromise
    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('after 3 failures, returns error', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const handle = createAbortableFetch(mockFetch)
    const responsePromise = handle.fetch('/page')

    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
    const rejectAssertion = expect(responsePromise).rejects.toThrow('Failed to fetch')

    // Advance through all retries
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)

    await rejectAssertion
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('4xx is NOT retried', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not found', { status: 404 })
    )
    const handle = createAbortableFetch(mockFetch)
    const response = await handle.fetch('/missing')
    expect(response.status).toBe(404)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('5xx IS retried', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    const handle = createAbortableFetch(mockFetch)
    const responsePromise = handle.fetch('/server-error')

    const response = await responsePromise
    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('abort during retry cancels the retry chain', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const handle = createAbortableFetch(mockFetch)
    const responsePromise = handle.fetch('/page')

    // Attach rejection handler early to avoid unhandled rejection
    const rejectAssertion = expect(responsePromise).rejects.toSatisfy(
      (e: DOMException) => e.name === 'AbortError'
    )

    // First retry fires immediately
    await vi.advanceTimersByTimeAsync(0)
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Abort before the 1s delay retry — delay resolves, loop checks signal.aborted
    handle.abort()

    // Advance timer so the delay resolves and the loop re-checks signal
    await vi.advanceTimersByTimeAsync(1000)

    // Should NOT have attempted 3rd fetch
    expect(mockFetch).toHaveBeenCalledTimes(2)
    await rejectAssertion
  })

  it('isInFlight() returns correct state', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(
      () => Promise.resolve(new Response('ok', { status: 200 }))
    )

    const handle = createAbortableFetch(mockFetch)
    expect(handle.isInFlight()).toBe(false)

    const promise = handle.fetch('/page')
    expect(handle.isInFlight()).toBe(true)

    await promise
    expect(handle.isInFlight()).toBe(false)
  })

  it('manual abort() produces AbortError that is not retried', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal !== undefined) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }
      })
    })

    const handle = createAbortableFetch(mockFetch)
    const promise = handle.fetch('/page')

    handle.abort()

    await expect(promise).rejects.toSatisfy(
      (e: DOMException) => e.name === 'AbortError'
    )
    // AbortError should NOT trigger retry — only 1 fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
