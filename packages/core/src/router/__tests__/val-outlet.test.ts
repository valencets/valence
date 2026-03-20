import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ValOutlet, findOutlet } from '../val-outlet.js'

describe('ValOutlet', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('is registered as custom element val-outlet', () => {
    const El = customElements.get('val-outlet')
    expect(El).toBeDefined()
  })

  it('creates from createElement', () => {
    const el = document.createElement('val-outlet')
    expect(el).toBeInstanceOf(ValOutlet)
  })

  it('creates from HTML tag', () => {
    document.body.innerHTML = '<val-outlet></val-outlet>'
    const el = document.querySelector('val-outlet')
    expect(el).toBeInstanceOf(ValOutlet)
  })

  it('exposes outletName as null when no name attribute', () => {
    const el = document.createElement('val-outlet') as ValOutlet
    expect(el.outletName).toBeNull()
  })

  it('exposes outletName from name attribute', () => {
    const el = document.createElement('val-outlet') as ValOutlet
    el.setAttribute('name', 'main')
    expect(el.outletName).toBe('main')
  })

  it('reflects name attribute changes', () => {
    const el = document.createElement('val-outlet') as ValOutlet
    el.setAttribute('name', 'sidebar')
    expect(el.outletName).toBe('sidebar')
    el.setAttribute('name', 'footer')
    expect(el.outletName).toBe('footer')
    el.removeAttribute('name')
    expect(el.outletName).toBeNull()
  })

  it('can hold child content', () => {
    const el = document.createElement('val-outlet') as ValOutlet
    el.innerHTML = '<p>Content</p>'
    document.body.appendChild(el)
    expect(el.querySelector('p')?.textContent).toBe('Content')
  })

  it('multiple named outlets can coexist', () => {
    document.body.innerHTML = `
      <val-outlet name="main"></val-outlet>
      <val-outlet name="sidebar"></val-outlet>
    `
    const outlets = document.querySelectorAll('val-outlet')
    expect(outlets.length).toBe(2)
    expect((outlets[0] as ValOutlet).outletName).toBe('main')
    expect((outlets[1] as ValOutlet).outletName).toBe('sidebar')
  })
})

describe('findOutlet', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns null when no outlet in container', () => {
    container.innerHTML = '<main><p>No outlet</p></main>'
    const result = findOutlet(container)
    expect(result).toBeNull()
  })

  it('finds default (unnamed) outlet', () => {
    container.innerHTML = '<val-outlet></val-outlet>'
    const result = findOutlet(container)
    expect(result).toBeInstanceOf(ValOutlet)
  })

  it('finds default outlet when name is undefined', () => {
    container.innerHTML = '<val-outlet></val-outlet>'
    const result = findOutlet(container, undefined)
    expect(result).toBeInstanceOf(ValOutlet)
  })

  it('finds named outlet by name', () => {
    container.innerHTML = '<val-outlet name="main"></val-outlet>'
    const result = findOutlet(container, 'main')
    expect(result).not.toBeNull()
    expect((result as ValOutlet).outletName).toBe('main')
  })

  it('returns null when named outlet not found', () => {
    container.innerHTML = '<val-outlet name="sidebar"></val-outlet>'
    const result = findOutlet(container, 'main')
    expect(result).toBeNull()
  })

  it('finds correct outlet among multiple named outlets', () => {
    container.innerHTML = `
      <val-outlet name="main"></val-outlet>
      <val-outlet name="sidebar"></val-outlet>
    `
    const mainResult = findOutlet(container, 'main')
    const sidebarResult = findOutlet(container, 'sidebar')
    expect((mainResult as ValOutlet).outletName).toBe('main')
    expect((sidebarResult as ValOutlet).outletName).toBe('sidebar')
  })

  it('finds default outlet when name arg is undefined and named outlets exist', () => {
    container.innerHTML = `
      <val-outlet></val-outlet>
      <val-outlet name="sidebar"></val-outlet>
    `
    const result = findOutlet(container, undefined)
    expect(result).not.toBeNull()
    expect((result as ValOutlet).outletName).toBeNull()
  })

  it('searches within the provided container element', () => {
    const outer = document.createElement('div')
    outer.innerHTML = '<val-outlet name="outer"></val-outlet>'
    const inner = document.createElement('div')
    inner.innerHTML = '<val-outlet name="inner"></val-outlet>'
    outer.appendChild(inner)
    container.appendChild(outer)

    const outerResult = findOutlet(outer, 'outer')
    const innerResult = findOutlet(inner, 'inner')
    expect((outerResult as ValOutlet).outletName).toBe('outer')
    expect((innerResult as ValOutlet).outletName).toBe('inner')
  })
})
