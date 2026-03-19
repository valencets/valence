export interface ScrollRestoreHandle {
  readonly saveCurrentPosition: () => void
  readonly restorePosition: (state?: unknown) => void
  readonly scrollToHash: (hash: string) => boolean
  readonly destroy: () => void
}

interface ScrollState {
  readonly scrollX: number
  readonly scrollY: number
}

function hasScrollState (state: unknown): state is ScrollState {
  if (state === null || typeof state !== 'object') return false
  const s = state as { scrollX?: unknown; scrollY?: unknown }
  return typeof s.scrollX === 'number' && typeof s.scrollY === 'number'
}

export function initScrollRestore (): ScrollRestoreHandle {
  function saveCurrentPosition (): void {
    const currentState = history.state as { url?: string; scrollX?: number; scrollY?: number } | null
    history.replaceState(
      { ...currentState, scrollX: window.scrollX, scrollY: window.scrollY },
      ''
    )
  }

  function restorePosition (state?: unknown): void {
    const s = (state ?? history.state) as unknown
    if (!hasScrollState(s)) return
    window.scrollTo(s.scrollX, s.scrollY)
  }

  function scrollToHash (hash: string): boolean {
    if (hash === '' || hash === '#') return false
    const id = hash.startsWith('#') ? hash.slice(1) : hash
    const element = document.getElementById(id)
    if (element === null) return false
    element.scrollIntoView()
    return true
  }

  function destroy (): void {
    // No listeners to clean up currently
  }

  return {
    saveCurrentPosition,
    restorePosition,
    scrollToHash,
    destroy
  }
}
