// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, afterEach } from 'vitest'

function buildNav (activePath: string): HTMLElement {
  const nav = document.createElement('nav')
  const links = ['/', '/pricing', '/how-it-works', '/free-site-audit', '/about']
  for (const href of links) {
    const a = document.createElement('a')
    a.setAttribute('href', href)
    a.textContent = href === '/' ? 'Home' : href.slice(1)
    if (href === activePath) {
      a.classList.add('nav-active')
      a.setAttribute('aria-current', 'page')
    }
    nav.appendChild(a)
  }
  // Brand link should be excluded from active toggling
  const brand = document.createElement('a')
  brand.setAttribute('href', '/')
  brand.classList.add('nav-brand')
  brand.textContent = 'Inertia'
  nav.prepend(brand)
  return nav
}

function simulateNavigation (pathname: string): void {
  window.history.pushState({}, '', pathname)
  document.dispatchEvent(new CustomEvent('inertia:navigated'))
}

describe('initNavActive', () => {
  let initNavActive: typeof import('../nav-active.js').initNavActive

  beforeAll(async () => {
    const mod = await import('../nav-active.js')
    initNavActive = mod.initNavActive
  })

  afterEach(() => {
    document.body.innerHTML = ''
    window.history.pushState({}, '', '/')
  })

  it('updates active class to match current path after navigated event', () => {
    const nav = buildNav('/')
    document.body.appendChild(nav)

    const handle = initNavActive()

    simulateNavigation('/pricing')

    const links = nav.querySelectorAll('a:not(.nav-brand)')
    const servicesLink = Array.from(links).find(a => a.getAttribute('href') === '/pricing')
    const homeLink = Array.from(links).find(a => a.getAttribute('href') === '/')

    expect(servicesLink?.classList.contains('nav-active')).toBe(true)
    expect(homeLink?.classList.contains('nav-active')).toBe(false)

    handle.destroy()
  })

  it('sets aria-current="page" on matching link and removes from others', () => {
    const nav = buildNav('/')
    document.body.appendChild(nav)

    const handle = initNavActive()

    simulateNavigation('/about')

    const links = nav.querySelectorAll('a:not(.nav-brand)')
    const aboutLink = Array.from(links).find(a => a.getAttribute('href') === '/about')
    const homeLink = Array.from(links).find(a => a.getAttribute('href') === '/')

    expect(aboutLink?.getAttribute('aria-current')).toBe('page')
    expect(homeLink?.hasAttribute('aria-current')).toBe(false)

    handle.destroy()
  })

  it('handles home "/" correctly', () => {
    const nav = buildNav('/pricing')
    document.body.appendChild(nav)

    const handle = initNavActive()

    simulateNavigation('/')

    const links = nav.querySelectorAll('a:not(.nav-brand)')
    const homeLink = Array.from(links).find(a => a.getAttribute('href') === '/')
    const servicesLink = Array.from(links).find(a => a.getAttribute('href') === '/pricing')

    expect(homeLink?.classList.contains('nav-active')).toBe(true)
    expect(servicesLink?.classList.contains('nav-active')).toBe(false)

    handle.destroy()
  })

  it('no-ops if nav is missing from DOM', () => {
    // No nav in DOM — should not throw
    const handle = initNavActive()

    simulateNavigation('/pricing')
    // No error means pass

    handle.destroy()
  })

  it('destroy() removes the event listener', () => {
    const nav = buildNav('/')
    document.body.appendChild(nav)

    const handle = initNavActive()
    handle.destroy()

    // Navigate after destroy — active class should NOT update
    simulateNavigation('/pricing')

    const homeLink = nav.querySelector('a[href="/"]:not(.nav-brand)')
    expect(homeLink?.classList.contains('nav-active')).toBe(true)
  })
})
