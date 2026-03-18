// Server Islands — deferred server-rendered fragments.
// The page shell ships immediately. Placeholders with [server:defer] and src
// fetch their content from server endpoints after initial render.

export interface IslandConfig {
  readonly fetchFn?: typeof fetch
}

export interface IslandHandle {
  readonly destroy: () => void
  readonly scanAndLoad: () => void
}

export function initServerIslands (config?: IslandConfig): IslandHandle {
  const fetchFn = config?.fetchFn ?? globalThis.fetch
  const loadedIslands = new WeakSet<Element>()
  const abortController = new AbortController()

  function scanAndLoad (): void {
    const islands = document.querySelectorAll('[server\\:defer][src]')

    for (const island of islands) {
      if (loadedIslands.has(island)) continue

      const src = island.getAttribute('src')
      if (src === null) continue

      loadedIslands.add(island)
      loadIsland(island, src)
    }
  }

  function loadIsland (island: Element, src: string): void {
    fetchFn(src, {
      headers: { 'X-Valence-Fragment': '1' },
      signal: abortController.signal
    })
      .then((response) => {
        if (!response.ok) {
          island.dispatchEvent(new CustomEvent('valence:island-error', {
            bubbles: true,
            detail: { src, status: response.status }
          }))
          return
        }
        return response.text()
      })
      .then((html) => {
        if (html === undefined) return
        island.innerHTML = html
        island.dispatchEvent(new CustomEvent('valence:island-loaded', {
          bubbles: true,
          detail: { src }
        }))
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return
        island.dispatchEvent(new CustomEvent('valence:island-error', {
          bubbles: true,
          detail: { src, error: error.message }
        }))
      })
  }

  function onAfterSwap (): void {
    scanAndLoad()
  }

  document.addEventListener('valence:after-swap', onAfterSwap)

  // Initial scan
  scanAndLoad()

  return {
    destroy () {
      abortController.abort()
      document.removeEventListener('valence:after-swap', onAfterSwap)
    },
    scanAndLoad
  }
}
