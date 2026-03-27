// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { reconcileFragment } from '../client/fragment-reconciler.js'

describe('reconcileFragment', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('swaps inner HTML of target element by data-store selector', () => {
    const target = document.createElement('div')
    target.setAttribute('data-store', 'counter')
    target.setAttribute('data-store-mode', 'fragment')
    target.innerHTML = '<p>Count: 0</p>'
    root.appendChild(target)

    reconcileFragment({
      selector: '[data-store="counter"]',
      html: '<p>Count: 42</p>'
    })

    expect(target.innerHTML).toBe('<p>Count: 42</p>')
  })

  it('does nothing if selector matches no element', () => {
    reconcileFragment({
      selector: '[data-store="nonexistent"]',
      html: '<p>Should not appear</p>'
    })
    expect(root.innerHTML).not.toContain('Should not appear')
  })

  it('removes is-pending class from children after swap', () => {
    const target = document.createElement('div')
    target.setAttribute('data-store', 'counter')
    target.setAttribute('data-store-mode', 'fragment')

    const btn = document.createElement('button')
    btn.classList.add('is-pending')
    btn.setAttribute('data-mutation', 'increment')
    target.appendChild(btn)
    root.appendChild(target)

    reconcileFragment({
      selector: '[data-store="counter"]',
      html: '<button data-mutation="increment">+1</button>'
    })

    const newBtn = target.querySelector('button')
    expect(newBtn).toBeDefined()
    expect(newBtn!.classList.contains('is-pending')).toBe(false)
  })

  it('swaps multiple targets if selector matches multiple elements', () => {
    const t1 = document.createElement('div')
    t1.setAttribute('data-store', 'counter')
    t1.setAttribute('data-store-mode', 'fragment')
    t1.innerHTML = '<p>Old 1</p>'
    root.appendChild(t1)

    const t2 = document.createElement('div')
    t2.setAttribute('data-store', 'counter')
    t2.setAttribute('data-store-mode', 'fragment')
    t2.innerHTML = '<p>Old 2</p>'
    root.appendChild(t2)

    reconcileFragment({
      selector: '[data-store="counter"]',
      html: '<p>Updated</p>'
    })

    expect(t1.innerHTML).toBe('<p>Updated</p>')
    expect(t2.innerHTML).toBe('<p>Updated</p>')
  })

  it('preserves element attributes after swap', () => {
    const target = document.createElement('div')
    target.setAttribute('data-store', 'cart')
    target.setAttribute('data-store-mode', 'fragment')
    target.setAttribute('class', 'cart-widget')
    target.innerHTML = '<p>Empty</p>'
    root.appendChild(target)

    reconcileFragment({
      selector: '[data-store="cart"]',
      html: '<p>1 item</p>'
    })

    expect(target.getAttribute('class')).toBe('cart-widget')
    expect(target.getAttribute('data-store')).toBe('cart')
    expect(target.innerHTML).toBe('<p>1 item</p>')
  })

  it('handles complex HTML with nested elements', () => {
    const target = document.createElement('div')
    target.setAttribute('data-store', 'blog')
    target.setAttribute('data-store-mode', 'fragment')
    root.appendChild(target)

    reconcileFragment({
      selector: '[data-store="blog"]',
      html: '<article><h2>Title</h2><p>Body text</p><footer><span>Author</span></footer></article>'
    })

    expect(target.querySelector('h2')!.textContent).toBe('Title')
    expect(target.querySelector('p')!.textContent).toBe('Body text')
    expect(target.querySelector('footer span')!.textContent).toBe('Author')
  })
})
