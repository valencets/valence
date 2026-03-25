import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDevOverlay } from '../dev-overlay.js'
import type { DevOverlayHandle } from '../dev-overlay.js'

function removeOverlay (): void {
  document.getElementById('val-dev-overlay')?.remove()
}

describe('initDevOverlay', () => {
  let handle: DevOverlayHandle

  beforeEach(() => {
    removeOverlay()
  })

  afterEach(() => {
    handle?.destroy()
    removeOverlay()
  })

  it('creates a floating overlay element in the DOM', () => {
    handle = initDevOverlay()

    const overlay = document.getElementById('val-dev-overlay')
    expect(overlay).not.toBeNull()
  })

  it('overlay is initially hidden', () => {
    handle = initDevOverlay()

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.style.display).toBe('none')
  })

  it('show() makes the overlay visible', () => {
    handle = initDevOverlay()
    handle.show()

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.style.display).not.toBe('none')
  })

  it('hide() hides the overlay', () => {
    handle = initDevOverlay()
    handle.show()
    handle.hide()

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.style.display).toBe('none')
  })

  it('toggle() shows the overlay when hidden', () => {
    handle = initDevOverlay()
    handle.toggle()

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.style.display).not.toBe('none')
  })

  it('toggle() hides the overlay when shown', () => {
    handle = initDevOverlay()
    handle.show()
    handle.toggle()

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.style.display).toBe('none')
  })

  it('destroy() removes the overlay from the DOM', () => {
    handle = initDevOverlay()
    handle.destroy()

    expect(document.getElementById('val-dev-overlay')).toBeNull()
  })

  it('overlay has inline position:fixed styles', () => {
    handle = initDevOverlay()

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.style.position).toBe('fixed')
  })

  it('overlay uses z-index high enough to be above page content', () => {
    handle = initDevOverlay()

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(Number(overlay.style.zIndex)).toBeGreaterThanOrEqual(9999)
  })

  it('does not use Record<string, string> for overlay styles', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(`${process.cwd()}/src/router/dev-overlay.ts`, 'utf-8')

    expect(source).not.toContain('Record<string, string>')
  })

  it('renders current pathname as text, not HTML', () => {
    window.history.replaceState({}, '', '/<img src=x onerror=alert(1)>')

    handle = initDevOverlay()
    handle.show()

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.textContent).toContain('/%3Cimg%20src=x%20onerror=alert(1)%3E')
    expect(overlay.querySelector('img')).toBeNull()
  })
})

describe('dev overlay navigation events', () => {
  let handle: DevOverlayHandle

  beforeEach(() => {
    removeOverlay()
    handle = initDevOverlay()
    handle.show()
  })

  afterEach(() => {
    handle.destroy()
    removeOverlay()
  })

  it('updates current route display on valence:navigated event', () => {
    const perfDetail = {
      source: 'network' as const,
      durationMs: 42,
      fromUrl: 'http://localhost/old',
      toUrl: 'http://localhost/new'
    }

    document.dispatchEvent(new CustomEvent('valence:navigated', {
      bubbles: true,
      detail: perfDetail
    }))

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.textContent).toContain('/new')
  })

  it('updates source display on valence:navigated event', () => {
    const perfDetail = {
      source: 'cache' as const,
      durationMs: 5,
      fromUrl: 'http://localhost/',
      toUrl: 'http://localhost/about'
    }

    document.dispatchEvent(new CustomEvent('valence:navigated', {
      bubbles: true,
      detail: perfDetail
    }))

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.textContent).toContain('cache')
  })

  it('updates duration display on valence:navigated event', () => {
    const perfDetail = {
      source: 'prefetch' as const,
      durationMs: 123,
      fromUrl: 'http://localhost/',
      toUrl: 'http://localhost/blog'
    }

    document.dispatchEvent(new CustomEvent('valence:navigated', {
      bubbles: true,
      detail: perfDetail
    }))

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.textContent).toContain('123')
  })

  it('renders navigated route text without parsing HTML', () => {
    const perfDetail = {
      source: 'network' as const,
      durationMs: 42,
      fromUrl: 'http://localhost/old',
      toUrl: '/<img src=x onerror=alert(1)>'
    }

    document.dispatchEvent(new CustomEvent('valence:navigated', {
      bubbles: true,
      detail: perfDetail
    }))

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.textContent).toContain('onerror=alert(1)')
    expect(overlay.querySelector('img')).toBeNull()
  })
})

describe('dev overlay keyboard shortcut', () => {
  let handle: DevOverlayHandle

  beforeEach(() => {
    removeOverlay()
    handle = initDevOverlay()
  })

  afterEach(() => {
    handle.destroy()
    removeOverlay()
  })

  it('Ctrl+Shift+D toggles overlay visibility', () => {
    // Initially hidden
    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.style.display).toBe('none')

    // Fire Ctrl+Shift+D
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'D',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true
    }))

    expect(overlay.style.display).not.toBe('none')

    // Fire again to hide
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'D',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true
    }))

    expect(overlay.style.display).toBe('none')
  })

  it('does not toggle on Ctrl+D alone', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'D',
      ctrlKey: true,
      shiftKey: false,
      bubbles: true
    }))

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.style.display).toBe('none')
  })

  it('does not toggle on Shift+D alone', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'D',
      ctrlKey: false,
      shiftKey: true,
      bubbles: true
    }))

    const overlay = document.getElementById('val-dev-overlay') as HTMLElement
    expect(overlay.style.display).toBe('none')
  })

  it('destroy() removes keyboard listener', () => {
    handle.destroy()

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'D',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true
    }))

    // After destroy, overlay is removed — shortcut should not recreate it
    expect(document.getElementById('val-dev-overlay')).toBeNull()
  })
})
