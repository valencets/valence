export interface HistoryStateShape {
  readonly url?: string | undefined
  readonly scrollX?: number | undefined
  readonly scrollY?: number | undefined
}

export interface ScrollRestoreHandle {
  readonly saveCurrentPosition: () => void
  readonly restorePosition: (state?: HistoryStateShape | null) => void
  readonly scrollToHash: (hash: string) => boolean
  readonly destroy: () => void
}

interface ScrollState {
  readonly scrollX: number
  readonly scrollY: number
}

function hasScrollState (state: HistoryStateShape | null): state is ScrollState {
  return state !== null &&
    typeof state.scrollX === 'number' &&
    typeof state.scrollY === 'number'
}

export function initScrollRestore (): ScrollRestoreHandle {
  function saveCurrentPosition (): void {
    const currentState = history.state as HistoryStateShape | null
    history.replaceState(
      { ...currentState, scrollX: window.scrollX, scrollY: window.scrollY },
      ''
    )
  }

  function restorePosition (state?: HistoryStateShape | null): void {
    const s = (state ?? history.state) as HistoryStateShape | null
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
