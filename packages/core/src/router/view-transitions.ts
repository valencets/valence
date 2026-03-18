// View Transitions API integration.
// Wraps the browser's startViewTransition around the router's fragment swap.
// Graceful fallback when the API is unavailable.

export function supportsViewTransitions (): boolean {
  return typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function'
}

export function applyTransitionNames (container: Element): void {
  for (const el of container.querySelectorAll('[transition\\:name]')) {
    const name = el.getAttribute('transition:name')
    if (name !== null) {
      ;(el as HTMLElement).style.viewTransitionName = name
    }
  }
}

export function clearTransitionNames (container: Element): void {
  for (const el of container.querySelectorAll('[transition\\:name]')) {
    ;(el as HTMLElement).style.viewTransitionName = ''
  }
}

export function wrapInTransition (doSwap: () => void, liveContainer: Element): void {
  if (!supportsViewTransitions()) {
    doSwap()
    return
  }

  applyTransitionNames(liveContainer)

  const transition = document.startViewTransition(() => {
    doSwap()
    applyTransitionNames(liveContainer)
  })

  transition.finished
    .then(() => clearTransitionNames(liveContainer))
    .catch(() => clearTransitionNames(liveContainer))
}
