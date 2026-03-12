import { describe, it, expect, afterEach } from 'vitest'

function buildNav (activePath: string): HTMLElement {
  const nav = document.createElement('nav')
  const links = ['/', '/services', '/principles', '/audit', '/about']
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

describe('initNavActive', () => {
  let initNavActive: typeof import('../nav-active.js').initNavActive
  let nav: HTMLElement

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('updates active class to match current path after navigated event', async () => {
    const mod = await import('../nav-active.js')
    initNavActive = mod.initNavActive
    nav = buildNav('/')
    document.body.appendChild(nav)

    const handle = initNavActive()

    // Simulate navigation to /services
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/services' },
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new CustomEvent('inertia:navigated'))

    const links = nav.querySelectorAll('a:not(.nav-brand)')
    const servicesLink = Array.from(links).find(a => a.getAttribute('href') === '/services')
    const homeLink = Array.from(links).find(a => a.getAttribute('href') === '/')

    expect(servicesLink?.classList.contains('nav-active')).toBe(true)
    expect(homeLink?.classList.contains('nav-active')).toBe(false)

    handle.destroy()
  })

  it('sets aria-current="page" on matching link and removes from others', async () => {
    const mod = await import('../nav-active.js')
    initNavActive = mod.initNavActive
    nav = buildNav('/')
    document.body.appendChild(nav)

    const handle = initNavActive()

    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/about' },
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new CustomEvent('inertia:navigated'))

    const links = nav.querySelectorAll('a:not(.nav-brand)')
    const aboutLink = Array.from(links).find(a => a.getAttribute('href') === '/about')
    const homeLink = Array.from(links).find(a => a.getAttribute('href') === '/')

    expect(aboutLink?.getAttribute('aria-current')).toBe('page')
    expect(homeLink?.hasAttribute('aria-current')).toBe(false)

    handle.destroy()
  })

  it('handles home "/" correctly', async () => {
    const mod = await import('../nav-active.js')
    initNavActive = mod.initNavActive
    nav = buildNav('/services')
    document.body.appendChild(nav)

    const handle = initNavActive()

    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/' },
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new CustomEvent('inertia:navigated'))

    const links = nav.querySelectorAll('a:not(.nav-brand)')
    const homeLink = Array.from(links).find(a => a.getAttribute('href') === '/')
    const servicesLink = Array.from(links).find(a => a.getAttribute('href') === '/services')

    expect(homeLink?.classList.contains('nav-active')).toBe(true)
    expect(servicesLink?.classList.contains('nav-active')).toBe(false)

    handle.destroy()
  })

  it('no-ops if nav is missing from DOM', async () => {
    const mod = await import('../nav-active.js')
    initNavActive = mod.initNavActive
    // No nav in DOM — should not throw
    const handle = initNavActive()

    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/services' },
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new CustomEvent('inertia:navigated'))
    // No error means pass

    handle.destroy()
  })

  it('destroy() removes the event listener', async () => {
    const mod = await import('../nav-active.js')
    initNavActive = mod.initNavActive
    nav = buildNav('/')
    document.body.appendChild(nav)

    const handle = initNavActive()
    handle.destroy()

    // Navigate after destroy — active class should NOT update
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/services' },
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new CustomEvent('inertia:navigated'))

    const homeLink = nav.querySelector('a[href="/"]')
    expect(homeLink?.classList.contains('nav-active')).toBe(true)
  })
})
