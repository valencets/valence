// Server Islands -- deferred server-rendered fragments.
// The page shell ships immediately. Placeholders with [server:defer] and src
// fetch their content from server endpoints after initial render.

import { ResultAsync } from '@valencets/resultkit'
import { fromThrowable } from '@valencets/resultkit'
import { parseHtml, stripScripts, validateFragmentResponse } from './fragment-swap.js'

export interface IslandConfig {
  readonly fetchFn?: typeof fetch
}

export interface IslandHandle {
  readonly destroy: () => void
  readonly scanAndLoad: () => void
}

export function initServerIslands (config?: IslandConfig): IslandHandle {
  const fetchFn = config?.fetchFn ?? globalThis.fetch
  const safeNewUrl = fromThrowable((value: string) => new URL(value, window.location.origin), () => null)
  const loadedIslands = new WeakSet<Element>()
  const loadingIslands = new WeakSet<Element>()
  const abortController = new AbortController()

  function normalizeIslandSrc (src: string): string | null {
    const result = safeNewUrl(src)
    if (result.isErr() || result.value === null) return null
    if (result.value.origin !== window.location.origin) return null
    return result.value.pathname + result.value.search
  }

  function scanAndLoad (): void {
    const islands = document.querySelectorAll('[server\\:defer][src]')

    for (const island of islands) {
      if (loadedIslands.has(island)) continue
      if (loadingIslands.has(island)) continue

      const src = island.getAttribute('src')
      if (src === null) continue
      const normalizedSrc = normalizeIslandSrc(src)
      if (normalizedSrc === null) {
        island.dispatchEvent(new CustomEvent('valence:island-error', {
          bubbles: true,
          detail: { src, error: `Island src must be same-origin: ${src}` }
        }))
        continue
      }

      loadingIslands.add(island)
      loadIsland(island, normalizedSrc)
    }
  }

  async function runIslandLoad (island: Element, src: string): Promise<void> {
    const response = await fetchFn(src, {
      headers: { 'X-Valence-Fragment': '1' },
      signal: abortController.signal
    })

    if (!response.ok) {
      loadingIslands.delete(island)
      island.dispatchEvent(new CustomEvent('valence:island-error', {
        bubbles: true,
        detail: { src, status: response.status }
      }))
      return
    }

    const validation = validateFragmentResponse(response)
    if (validation.isErr()) {
      loadingIslands.delete(island)
      island.dispatchEvent(new CustomEvent('valence:island-error', {
        bubbles: true,
        detail: { src, error: validation.error.message }
      }))
      return
    }

    const html = await response.text()
    const docResult = parseHtml(html)
    if (docResult.isErr()) {
      loadingIslands.delete(island)
      island.dispatchEvent(new CustomEvent('valence:island-error', {
        bubbles: true,
        detail: { src, error: docResult.error.message }
      }))
      return
    }

    stripScripts(docResult.value)

    const fragment = document.createDocumentFragment()
    for (const child of Array.from(docResult.value.body.childNodes)) {
      fragment.appendChild(child.cloneNode(true))
    }

    island.replaceChildren(fragment)
    loadingIslands.delete(island)
    loadedIslands.add(island)
    island.dispatchEvent(new CustomEvent('valence:island-loaded', {
      bubbles: true,
      detail: { src }
    }))
  }

  function loadIsland (island: Element, src: string): void {
    ResultAsync.fromPromise(
      runIslandLoad(island, src),
      (reason) => reason instanceof Error ? reason : new Error(String(reason))
    ).match(
      () => {
        loadingIslands.delete(island)
      },
      (reason) => {
        loadingIslands.delete(island)
        if (reason instanceof Error && reason.name === 'AbortError') return
        const message = reason instanceof Error ? reason.message : 'Island load failed'
        island.dispatchEvent(new CustomEvent('valence:island-error', {
          bubbles: true,
          detail: { src, error: message }
        }))
      }
    )
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
