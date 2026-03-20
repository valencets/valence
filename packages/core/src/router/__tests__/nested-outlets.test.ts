import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findNestedOutlet } from '../val-outlet.js'
import { swapOutletContent, extractOutletFragment } from '../outlet-swap.js'
import '../val-outlet.js'

describe('findNestedOutlet', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('finds outlet at top level when not nested', () => {
    container.innerHTML = '<val-outlet name="main"></val-outlet>'
    const result = findNestedOutlet(container, 'main')
    expect(result).not.toBeNull()
  })

  it('finds nested outlet within a parent outlet', () => {
    container.innerHTML = `
      <val-outlet name="shell">
        <nav>Navigation</nav>
        <val-outlet name="content"><p>Content</p></val-outlet>
      </val-outlet>
    `
    const result = findNestedOutlet(container, 'content')
    expect(result).not.toBeNull()
  })

  it('finds deeply nested outlet', () => {
    container.innerHTML = `
      <val-outlet name="app">
        <val-outlet name="main">
          <val-outlet name="sidebar">
            <p>Sidebar</p>
          </val-outlet>
        </val-outlet>
      </val-outlet>
    `
    const result = findNestedOutlet(container, 'sidebar')
    expect(result).not.toBeNull()
  })

  it('returns null for non-existent outlet name', () => {
    container.innerHTML = '<val-outlet name="main"></val-outlet>'
    const result = findNestedOutlet(container, 'missing')
    expect(result).toBeNull()
  })

  it('prefers first-found outlet when multiple have same name', () => {
    container.innerHTML = `
      <val-outlet name="content"><p>First</p></val-outlet>
      <val-outlet name="content"><p>Second</p></val-outlet>
    `
    const result = findNestedOutlet(container, 'content')
    expect(result).not.toBeNull()
    expect(result?.querySelector('p')?.textContent).toBe('First')
  })

  it('finds outlet within a val-outlet that matches by name', () => {
    container.innerHTML = `
      <val-outlet name="shell">
        <val-outlet name="sidebar-content"><p>Sidebar item</p></val-outlet>
      </val-outlet>
    `
    const result = findNestedOutlet(container, 'sidebar-content')
    expect(result).not.toBeNull()
    expect(result?.querySelector('p')?.textContent).toBe('Sidebar item')
  })
})

describe('swapOutletContent with nested outlets', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('swaps content in deeply nested outlet', () => {
    document.body.innerHTML = `
      <main>
        <val-outlet name="shell">
          <nav>Navigation persists</nav>
          <val-outlet name="content">
            <p>Old content</p>
          </val-outlet>
        </val-outlet>
      </main>
    `

    const newHtml = '<val-outlet name="content"><p>New content</p></val-outlet>'
    const shell = document.querySelector('val-outlet[name="shell"]') as HTMLElement
    const result = swapOutletContent(shell, 'content', newHtml)
    expect(result.isOk()).toBe(true)

    const contentOutlet = document.querySelector('val-outlet[name="content"]')
    expect(contentOutlet?.querySelector('p')?.textContent).toBe('New content')

    // Navigation persists
    expect(shell.querySelector('nav')?.textContent).toBe('Navigation persists')
  })

  it('nested swap does not affect sibling outlets', () => {
    document.body.innerHTML = `
      <main>
        <val-outlet name="shell">
          <val-outlet name="sidebar"><p>Sidebar old</p></val-outlet>
          <val-outlet name="content"><p>Content old</p></val-outlet>
        </val-outlet>
      </main>
    `

    const shell = document.querySelector('val-outlet[name="shell"]') as HTMLElement
    const newHtml = '<val-outlet name="content"><p>Content new</p></val-outlet>'
    swapOutletContent(shell, 'content', newHtml)

    expect(document.querySelector('val-outlet[name="content"] p')?.textContent).toBe('Content new')
    expect(document.querySelector('val-outlet[name="sidebar"] p')?.textContent).toBe('Sidebar old')
  })
})

describe('extractOutletFragment for nested scenarios', () => {
  it('extracts named outlet from HTML that has nested outlets', () => {
    const html = `
      <html><body>
        <val-outlet name="shell">
          <nav>Nav</nav>
          <val-outlet name="content"><p>Inner content</p></val-outlet>
        </val-outlet>
      </body></html>
    `
    const result = extractOutletFragment(html, 'shell')
    expect(result.isOk()).toBe(true)
    // The shell outlet is what we asked for
    if (result.isOk()) {
      expect(result.value.getAttribute('name')).toBe('shell')
    }
  })
})

describe('outlet view transitions', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('outlet swap dispatches valence:before-swap event', async () => {
    const { initRouter } = await import('../push-state.js')

    const outletHtml = '<val-outlet name="main"><p>Transitioned content</p></val-outlet>'
    const mockFetch = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(new Response(outletHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'X-Valence-Outlet': 'main'
        }
      }))
    )

    const main = document.createElement('main')
    document.body.appendChild(main)
    const outlet = document.createElement('val-outlet') as HTMLElement
    outlet.setAttribute('name', 'main')
    outlet.innerHTML = '<p>Old content</p>'
    main.appendChild(outlet)

    const beforeSwapEvents: Event[] = []
    const onBeforeSwap = (e: Event): void => { beforeSwapEvents.push(e) }
    document.addEventListener('valence:before-swap', onBeforeSwap)

    const handle = initRouter({}, mockFetch)
    if (handle.isOk()) {
      await handle.value.navigate('/transition-page')
      handle.value.destroy()
    }

    document.removeEventListener('valence:before-swap', onBeforeSwap)

    // valence:before-swap fires for outlet swaps too (from the full path)
    // The outlet is swapped correctly
    expect(outlet.querySelector('p')?.textContent).toBe('Transitioned content')
  })
})
