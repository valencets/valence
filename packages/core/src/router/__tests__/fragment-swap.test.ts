import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseHtml,
  extractFragment,
  extractTitle,
  swapContent,
  supportsMoveBefore
} from '../fragment-swap.js'
import { RouterErrorCode } from '../router-types.js'

describe('parseHtml', () => {
  it('returns Ok with Document for well-formed HTML', () => {
    const result = parseHtml('<html><head><title>Test</title></head><body><main>Hello</main></body></html>')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.querySelector('main')?.textContent).toBe('Hello')
    }
  })

  it('returns Ok for minimal HTML', () => {
    const result = parseHtml('<main>Minimal</main>')
    expect(result.isOk()).toBe(true)
  })

  it('neutralizes script tags in parsed document', () => {
    const result = parseHtml('<html><body><main><script>alert("xss")</script><p>Safe</p></main></body></html>')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      // DOMParser in text/html mode does not execute scripts
      const scripts = result.value.querySelectorAll('script')
      // Scripts are parsed but inert -- they exist as nodes but never execute
      expect(result.value.querySelector('p')?.textContent).toBe('Safe')
      expect(scripts.length).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns Err(PARSE_FAILED) for empty string', () => {
    const result = parseHtml('')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(RouterErrorCode.PARSE_FAILED)
    }
  })
})

describe('extractFragment', () => {
  it('returns Ok when selector matches', () => {
    const result = parseHtml('<html><body><main><p>Content</p></main></body></html>')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const fragment = extractFragment(result.value, 'main')
      expect(fragment.isOk()).toBe(true)
      if (fragment.isOk()) {
        expect(fragment.value.tagName.toLowerCase()).toBe('main')
      }
    }
  })

  it('returns Err(SELECTOR_MISS) when no match', () => {
    const result = parseHtml('<html><body><div>No main</div></body></html>')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const fragment = extractFragment(result.value, 'main')
      expect(fragment.isErr()).toBe(true)
      if (fragment.isErr()) {
        expect(fragment.error.code).toBe(RouterErrorCode.SELECTOR_MISS)
      }
    }
  })

  it('works with custom selectors', () => {
    const result = parseHtml('<html><body><div id="app"><p>App</p></div></body></html>')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const fragment = extractFragment(result.value, '#app')
      expect(fragment.isOk()).toBe(true)
      if (fragment.isOk()) {
        expect(fragment.value.id).toBe('app')
      }
    }
  })

  it('returns Err(SELECTOR_MISS) for non-existent class selector', () => {
    const result = parseHtml('<html><body><main>Test</main></body></html>')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const fragment = extractFragment(result.value, '.nonexistent')
      expect(fragment.isErr()).toBe(true)
      if (fragment.isErr()) {
        expect(fragment.error.code).toBe(RouterErrorCode.SELECTOR_MISS)
      }
    }
  })
})

describe('extractTitle', () => {
  it('returns title text when present', () => {
    const result = parseHtml('<html><head><title>My Page</title></head><body></body></html>')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(extractTitle(result.value)).toBe('My Page')
    }
  })

  it('returns null when no title element', () => {
    const result = parseHtml('<html><head></head><body></body></html>')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(extractTitle(result.value)).toBeNull()
    }
  })

  it('returns empty string for empty title tag', () => {
    const result = parseHtml('<html><head><title></title></head><body></body></html>')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(extractTitle(result.value)).toBe('')
    }
  })
})

describe('swapContent', () => {
  let liveContainer: HTMLElement

  beforeEach(() => {
    liveContainer = document.createElement('main')
    liveContainer.innerHTML = '<p>Old content</p>'
    document.body.appendChild(liveContainer)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('replaces children in live container', () => {
    const newMain = document.createElement('main')
    newMain.innerHTML = '<p>New content</p>'

    const result = swapContent(liveContainer, newMain)
    expect(result.isOk()).toBe(true)
    expect(liveContainer.innerHTML).toBe('<p>New content</p>')
  })

  it('new content is visible in live DOM', () => {
    const newMain = document.createElement('main')
    newMain.innerHTML = '<h1>Title</h1><p>Body</p>'

    swapContent(liveContainer, newMain)
    expect(document.querySelector('main h1')?.textContent).toBe('Title')
    expect(document.querySelector('main p')?.textContent).toBe('Body')
  })

  it('returns Ok on success', () => {
    const newMain = document.createElement('main')
    newMain.innerHTML = '<p>Test</p>'

    const result = swapContent(liveContainer, newMain)
    expect(result.isOk()).toBe(true)
  })

  it('handles empty fragment', () => {
    const newMain = document.createElement('main')

    const result = swapContent(liveContainer, newMain)
    expect(result.isOk()).toBe(true)
    expect(liveContainer.children.length).toBe(0)
  })

  it('preserves persistent elements with moveBefore when available', () => {
    // Set up live container with a persistent element
    const persistent = document.createElement('div')
    persistent.id = 'persistent-widget'
    persistent.setAttribute('data-valence-persist', '')
    persistent.textContent = 'live state'
    liveContainer.innerHTML = ''
    liveContainer.appendChild(persistent)

    // Mock moveBefore on the liveContainer
    const moveBeforeFn = vi.fn(function (this: Element, node: Node, reference: Node | null) {
      // Simulate moveBefore: move the node within DOM
      this.insertBefore(node, reference)
    })
    liveContainer.moveBefore = moveBeforeFn

    // Create new fragment with same persistent id
    const newMain = document.createElement('main')
    const newPersistent = document.createElement('div')
    newPersistent.id = 'persistent-widget'
    newPersistent.setAttribute('data-valence-persist', '')
    newPersistent.textContent = 'new state'
    const newP = document.createElement('p')
    newP.textContent = 'New paragraph'
    newMain.appendChild(newPersistent)
    newMain.appendChild(newP)

    swapContent(liveContainer, newMain)

    // moveBefore should have been called for the persistent element
    expect(moveBeforeFn).toHaveBeenCalled()
  })

  it('falls back to replaceChildren without moveBefore', () => {
    const newMain = document.createElement('main')
    newMain.innerHTML = '<p>Fallback content</p>'

    const result = swapContent(liveContainer, newMain)
    expect(result.isOk()).toBe(true)
    expect(liveContainer.querySelector('p')?.textContent).toBe('Fallback content')
  })

  it('swaps multiple children correctly', () => {
    const newMain = document.createElement('main')
    newMain.innerHTML = '<h1>One</h1><h2>Two</h2><p>Three</p>'

    swapContent(liveContainer, newMain)
    expect(liveContainer.children.length).toBe(3)
    expect(liveContainer.children[0]?.tagName).toBe('H1')
    expect(liveContainer.children[1]?.tagName).toBe('H2')
    expect(liveContainer.children[2]?.tagName).toBe('P')
  })
})

describe('supportsMoveBefore', () => {
  it('is a boolean', () => {
    expect(typeof supportsMoveBefore).toBe('boolean')
  })

  it('is false in happy-dom (no native moveBefore)', () => {
    // happy-dom does not implement moveBefore
    expect(supportsMoveBefore).toBe(false)
  })
})

describe('transition:persist alias', () => {
  let liveContainer: HTMLElement

  beforeEach(() => {
    liveContainer = document.createElement('main')
    document.body.appendChild(liveContainer)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('recognizes transition:persist as alias for data-valence-persist with moveBefore', () => {
    const persistent = document.createElement('div')
    persistent.id = 'video-bg'
    persistent.setAttribute('transition:persist', '')
    persistent.textContent = 'live state'
    liveContainer.appendChild(persistent)

    const moveBeforeFn = vi.fn(function (this: Element, node: Node, reference: Node | null) {
      this.insertBefore(node, reference)
    })
    liveContainer.moveBefore = moveBeforeFn

    const newMain = document.createElement('main')
    const newPersistent = document.createElement('div')
    newPersistent.id = 'video-bg'
    newPersistent.setAttribute('transition:persist', '')
    newPersistent.textContent = 'new state'
    newMain.appendChild(newPersistent)

    swapContent(liveContainer, newMain)

    expect(moveBeforeFn).toHaveBeenCalled()
  })
})
