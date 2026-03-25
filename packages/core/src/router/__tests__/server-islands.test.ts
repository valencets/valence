import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initServerIslands } from '../server-islands.js'

describe('Server Islands', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('main')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  describe('initServerIslands', () => {
    it('scans DOM for [server:defer] elements and fetches their src', async () => {
      container.innerHTML = `
        <div server:defer src="/api/islands/related">
          <span>Loading...</span>
        </div>
      `

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'Content-Type': 'text/html',
          'X-Valence-Fragment': '1'
        }),
        text: () => Promise.resolve('<p>Related posts here</p>')
      })

      const handle = initServerIslands({ fetchFn: mockFetch })

      // Wait for fetch + innerHTML swap to complete
      const island = container.querySelector('[server\\:defer]')!
      await vi.waitFor(() => {
        expect(island.innerHTML).toBe('<p>Related posts here</p>')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/islands/related',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Valence-Fragment': '1' })
        })
      )

      handle.destroy()
    })

    it('preserves fallback content until fetch completes', () => {
      container.innerHTML = `
        <div server:defer src="/api/islands/slow">
          <span class="fallback">Loading...</span>
        </div>
      `

      // Never-resolving fetch
      const mockFetch = vi.fn().mockReturnValue(new Promise(() => {}))
      const handle = initServerIslands({ fetchFn: mockFetch })

      const fallback = container.querySelector('.fallback')
      expect(fallback).not.toBeNull()
      expect(fallback!.textContent).toBe('Loading...')

      handle.destroy()
    })

    it('does not re-fetch already loaded islands on re-scan', async () => {
      container.innerHTML = `
        <div server:defer src="/api/islands/once">
          <span>Loading...</span>
        </div>
      `

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'Content-Type': 'text/html',
          'X-Valence-Fragment': '1'
        }),
        text: () => Promise.resolve('<p>Done</p>')
      })

      const handle = initServerIslands({ fetchFn: mockFetch })

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledOnce()
      })

      // Manual re-scan should NOT re-fetch
      handle.scanAndLoad()

      // Still only called once
      expect(mockFetch).toHaveBeenCalledOnce()

      handle.destroy()
    })
  })

  describe('valence:after-swap re-scan', () => {
    it('scans new content after navigation swap', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'Content-Type': 'text/html',
          'X-Valence-Fragment': '1'
        }),
        text: () => Promise.resolve('<p>Content</p>')
      })

      const handle = initServerIslands({ fetchFn: mockFetch })

      // No islands initially
      expect(mockFetch).not.toHaveBeenCalled()

      // Simulate navigation adding a new island
      container.innerHTML = `
        <div server:defer src="/api/islands/new">
          <span>Loading...</span>
        </div>
      `
      document.dispatchEvent(new CustomEvent('valence:after-swap'))

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledOnce()
      })

      handle.destroy()
    })
  })

  describe('destroy', () => {
    it('aborts in-flight fetches', async () => {
      container.innerHTML = `
        <div server:defer src="/api/islands/abort-me">
          <span>Loading...</span>
        </div>
      `

      let abortSignal: AbortSignal | undefined
      const mockFetch = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
        abortSignal = opts.signal as AbortSignal
        return new Promise(() => {}) // Never resolves
      })

      const handle = initServerIslands({ fetchFn: mockFetch })

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledOnce()
      })

      handle.destroy()

      expect(abortSignal!.aborted).toBe(true)
    })
  })

  describe('error handling', () => {
    it('keeps fallback on fetch failure and dispatches island-error', async () => {
      container.innerHTML = `
        <div server:defer src="/api/islands/broken">
          <span class="fallback">Fallback</span>
        </div>
      `

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      })

      const errorListener = vi.fn()
      document.addEventListener('valence:island-error', errorListener)

      const handle = initServerIslands({ fetchFn: mockFetch })

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledOnce()
      })

      // Fallback preserved
      expect(container.querySelector('.fallback')).not.toBeNull()

      // Error event dispatched
      await vi.waitFor(() => {
        expect(errorListener).toHaveBeenCalledOnce()
      })

      document.removeEventListener('valence:island-error', errorListener)
      handle.destroy()
    })

    it('dispatches island-loaded on success', async () => {
      container.innerHTML = `
        <div server:defer src="/api/islands/good">
          <span>Loading...</span>
        </div>
      `

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'Content-Type': 'text/html',
          'X-Valence-Fragment': '1'
        }),
        text: () => Promise.resolve('<p>Loaded!</p>')
      })

      const loadedListener = vi.fn()
      document.addEventListener('valence:island-loaded', loadedListener)

      const handle = initServerIslands({ fetchFn: mockFetch })

      await vi.waitFor(() => {
        expect(loadedListener).toHaveBeenCalledOnce()
      })

      document.removeEventListener('valence:island-loaded', loadedListener)
      handle.destroy()
    })

    it('preserves fallback and dispatches error when fragment header is missing', async () => {
      container.innerHTML = `
        <div server:defer src="/api/islands/missing-fragment">
          <span class="fallback">Fallback</span>
        </div>
      `

      const mockFetch = vi.fn().mockResolvedValue(
        new Response('<p>Loaded!</p>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        })
      )

      const errorListener = vi.fn()
      document.addEventListener('valence:island-error', errorListener)

      const handle = initServerIslands({ fetchFn: mockFetch })

      await vi.waitFor(() => {
        expect(errorListener).toHaveBeenCalledOnce()
      })

      expect(container.querySelector('.fallback')).not.toBeNull()
      expect(container.querySelector('p')).toBeNull()

      document.removeEventListener('valence:island-error', errorListener)
      handle.destroy()
    })

    it('preserves fallback and dispatches error on non-html island responses', async () => {
      container.innerHTML = `
        <div server:defer src="/api/islands/json">
          <span class="fallback">Fallback</span>
        </div>
      `

      const mockFetch = vi.fn().mockResolvedValue(
        new Response('{"ok":true}', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Valence-Fragment': '1'
          }
        })
      )

      const errorListener = vi.fn()
      document.addEventListener('valence:island-error', errorListener)

      const handle = initServerIslands({ fetchFn: mockFetch })

      await vi.waitFor(() => {
        expect(errorListener).toHaveBeenCalledOnce()
      })

      expect(container.querySelector('.fallback')).not.toBeNull()
      expect(container.textContent).toContain('Fallback')

      document.removeEventListener('valence:island-error', errorListener)
      handle.destroy()
    })

    it('strips scripts before inserting island content', async () => {
      container.innerHTML = `
        <div server:defer src="/api/islands/scripted">
          <span>Loading...</span>
        </div>
      `

      const mockFetch = vi.fn().mockResolvedValue(
        new Response('<div><p>Safe</p><script>evil()</script></div>', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'X-Valence-Fragment': '1'
          }
        })
      )

      const handle = initServerIslands({ fetchFn: mockFetch })
      const island = container.querySelector('[server\\:defer]')!

      await vi.waitFor(() => {
        expect(island.querySelector('p')?.textContent).toBe('Safe')
      })

      expect(island.querySelector('script')).toBeNull()

      handle.destroy()
    })

    it('retries island loading after an earlier failure', async () => {
      container.innerHTML = `
        <div server:defer src="/api/islands/retry">
          <span class="fallback">Fallback</span>
        </div>
      `

      let attempts = 0
      const mockFetch = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts === 1) {
          return Promise.resolve(new Response('<p>Bad</p>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          }))
        }

        return Promise.resolve(new Response('<p>Recovered</p>', {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'X-Valence-Fragment': '1'
          }
        }))
      })

      const handle = initServerIslands({ fetchFn: mockFetch })

      const errorListener = vi.fn()
      document.addEventListener('valence:island-error', errorListener)

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledOnce()
      })

      await vi.waitFor(() => {
        expect(errorListener).toHaveBeenCalledOnce()
      })

      expect(container.querySelector('.fallback')).not.toBeNull()

      handle.scanAndLoad()

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      await vi.waitFor(() => {
        expect(container.querySelector('p')?.textContent).toBe('Recovered')
      })

      document.removeEventListener('valence:island-error', errorListener)
      handle.destroy()
    })

    it('does not use raw promise catches in island loading', async () => {
      const source = await import('node:fs/promises').then(fs =>
        fs.readFile(`${process.cwd()}/src/router/server-islands.ts`, 'utf8')
      )

      expect(source).not.toMatch(/loadIsland[\s\S]*\.catch\(/)
    })
  })
})
