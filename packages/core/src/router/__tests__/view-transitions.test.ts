import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  supportsViewTransitions,
  applyTransitionNames,
  clearTransitionNames,
  wrapInTransition
} from '../view-transitions.js'

describe('supportsViewTransitions', () => {
  it('returns false in happy-dom (no startViewTransition)', () => {
    expect(supportsViewTransitions()).toBe(false)
  })

  it('returns true when startViewTransition is available', () => {
    const orig = document.startViewTransition
    document.startViewTransition = vi.fn() as typeof document.startViewTransition
    expect(supportsViewTransitions()).toBe(true)
    document.startViewTransition = orig
  })
})

describe('applyTransitionNames', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('main')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('sets view-transition-name from transition:name attribute', () => {
    const h1 = document.createElement('h1')
    h1.setAttribute('transition:name', 'page-title')
    container.appendChild(h1)

    applyTransitionNames(container)

    expect(h1.style.viewTransitionName).toBe('page-title')
  })

  it('handles multiple elements with transition:name', () => {
    const h1 = document.createElement('h1')
    h1.setAttribute('transition:name', 'heading')
    const img = document.createElement('img')
    img.setAttribute('transition:name', 'hero-image')
    container.appendChild(h1)
    container.appendChild(img)

    applyTransitionNames(container)

    expect(h1.style.viewTransitionName).toBe('heading')
    expect(img.style.viewTransitionName).toBe('hero-image')
  })

  it('ignores elements without transition:name', () => {
    const p = document.createElement('p')
    p.textContent = 'No transition name'
    container.appendChild(p)

    applyTransitionNames(container)

    expect(p.style.viewTransitionName).toBeFalsy()
  })
})

describe('clearTransitionNames', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('main')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('removes view-transition-name from elements', () => {
    const h1 = document.createElement('h1')
    h1.setAttribute('transition:name', 'page-title')
    h1.style.viewTransitionName = 'page-title'
    container.appendChild(h1)

    clearTransitionNames(container)

    expect(h1.style.viewTransitionName).toBe('')
  })
})

describe('wrapInTransition', () => {
  it('calls doSwap directly when transitions not supported', () => {
    const doSwap = vi.fn()

    wrapInTransition(doSwap, document.createElement('div'))

    expect(doSwap).toHaveBeenCalledOnce()
  })

  it('wraps doSwap in startViewTransition when supported', () => {
    const doSwap = vi.fn()
    const container = document.createElement('div')

    let capturedCallback: (() => void) | null = null
    const mockTransition = {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: vi.fn()
    }
    document.startViewTransition = vi.fn((cb: () => void) => {
      capturedCallback = cb
      cb() // Browser calls the callback
      return mockTransition
    }) as typeof document.startViewTransition

    wrapInTransition(doSwap, container)

    expect(document.startViewTransition).toHaveBeenCalledOnce()
    expect(capturedCallback).not.toBeNull()
    expect(doSwap).toHaveBeenCalledOnce()

    // Cleanup
    delete (document as Partial<Document>).startViewTransition
  })

  it('applies transition names before and after swap', () => {
    const container = document.createElement('main')
    const h1 = document.createElement('h1')
    h1.setAttribute('transition:name', 'heading')
    container.appendChild(h1)

    const mockTransition = {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: vi.fn()
    }
    document.startViewTransition = vi.fn((cb: () => void) => {
      // Before callback: old content names should be set
      expect(h1.style.viewTransitionName).toBe('heading')
      cb()
      return mockTransition
    }) as typeof document.startViewTransition

    const doSwap = vi.fn()
    wrapInTransition(doSwap, container)

    expect(document.startViewTransition).toHaveBeenCalled()

    delete (document as Partial<Document>).startViewTransition
  })
})
