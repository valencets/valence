// Dev-mode debug overlay for the Valence router.
// Shows current route, last navigation timing, source, and duration.
// Toggled with Ctrl+Shift+D. Only injected when caller invokes initDevOverlay().

import type { NavigationPerformance } from './router-types.js'

export interface DevOverlayHandle {
  readonly show: () => void
  readonly hide: () => void
  readonly toggle: () => void
  readonly destroy: () => void
}

const OVERLAY_ID = 'val-dev-overlay'

// Static inline styles as a dictionary to avoid string concatenation issues
const PANEL_STYLES: Record<string, string> = {
  position: 'fixed',
  bottom: '16px',
  right: '16px',
  zIndex: '9999',
  background: 'rgba(10, 10, 20, 0.92)',
  color: '#e2e8f0',
  fontFamily: 'monospace',
  fontSize: '12px',
  lineHeight: '1.6',
  padding: '12px 16px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  minWidth: '260px',
  maxWidth: '400px',
  display: 'none'
}

function applyStyles (el: HTMLElement, styles: Record<string, string>): void {
  for (const [key, value] of Object.entries(styles)) {
    el.style.setProperty(
      key.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`),
      value
    )
  }
}

function createPanel (): HTMLElement {
  const panel = document.createElement('div')
  panel.id = OVERLAY_ID
  panel.setAttribute('aria-live', 'polite')
  panel.setAttribute('data-val-dev', '')
  applyStyles(panel, PANEL_STYLES)
  renderContent(panel, null)
  return panel
}

function appendTextLine (
  panel: HTMLElement,
  label: string,
  value: string,
  color: string
): void {
  const line = document.createElement('div')
  line.append(`${label}: `)

  const valueSpan = document.createElement('span')
  valueSpan.style.color = color
  valueSpan.textContent = value
  line.appendChild(valueSpan)

  panel.appendChild(line)
}

function renderContent (panel: HTMLElement, perf: NavigationPerformance | null): void {
  const route = perf !== null ? perf.toUrl : window.location.pathname
  const source = perf !== null ? perf.source : '—'
  const duration = perf !== null ? `${String(perf.durationMs)}ms` : '—'

  panel.replaceChildren()

  const title = document.createElement('b')
  title.style.color = '#7dd3fc'
  title.textContent = 'Valence Dev'
  panel.appendChild(title)

  appendTextLine(panel, 'Route', route, '#86efac')
  appendTextLine(panel, 'Source', source, '#fde68a')
  appendTextLine(panel, 'Duration', duration, '#c4b5fd')

  const hint = document.createElement('div')
  hint.style.marginTop = '6px'
  hint.style.opacity = '0.5'
  hint.style.fontSize = '10px'
  hint.textContent = 'Ctrl+Shift+D to toggle'
  panel.appendChild(hint)
}

/**
 * Initialise the dev overlay. Returns a handle with show/hide/toggle/destroy.
 * The overlay starts hidden. The caller controls when and whether to inject it.
 */
export function initDevOverlay (): DevOverlayHandle {
  const panel = createPanel()
  document.body.appendChild(panel)

  let lastPerf: NavigationPerformance | null = null

  function onNavigated (event: Event): void {
    lastPerf = (event as CustomEvent<NavigationPerformance>).detail
    renderContent(panel, lastPerf)
  }

  function onKeydown (event: Event): void {
    const ke = event as KeyboardEvent
    if (ke.ctrlKey && ke.shiftKey && ke.key === 'D') {
      toggle()
    }
  }

  document.addEventListener('valence:navigated', onNavigated)
  document.addEventListener('keydown', onKeydown)

  function show (): void {
    panel.style.display = 'block'
  }

  function hide (): void {
    panel.style.display = 'none'
  }

  function toggle (): void {
    if (panel.style.display === 'none') {
      show()
    } else {
      hide()
    }
  }

  function destroy (): void {
    document.removeEventListener('valence:navigated', onNavigated)
    document.removeEventListener('keydown', onKeydown)
    panel.remove()
  }

  return { show, hide, toggle, destroy }
}
