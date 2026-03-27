// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initMutationDelegation } from '../client/mutation-delegate.js'

describe('initMutationDelegation', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns a handle with destroy', () => {
    const handle = initMutationDelegation(root, {})
    expect(handle).toBeDefined()
    expect(typeof handle.destroy).toBe('function')
    handle.destroy()
  })

  it('fires mutation on click of data-mutation element', async () => {
    const mutate = vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false })
    const stores = {
      counter: { mutations: { increment: mutate }, signals: {} }
    }

    const handle = initMutationDelegation(root, stores)

    const btn = document.createElement('button')
    btn.setAttribute('data-store', 'counter')
    btn.setAttribute('data-mutation', 'increment')
    btn.setAttribute('data-args', '{"amount":1}')
    root.appendChild(btn)

    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(mutate).toHaveBeenCalledWith({ amount: 1 })
    handle.destroy()
  })

  it('adds is-pending class on click, removes after mutation resolves', async () => {
    let resolveMutation: () => void = () => {}
    const mutate = vi.fn().mockReturnValue(new Promise(resolve => {
      resolveMutation = () => resolve({ isOk: () => true, isErr: () => false })
    }))
    const stores = {
      counter: { mutations: { increment: mutate }, signals: {} }
    }

    const handle = initMutationDelegation(root, stores)

    const btn = document.createElement('button')
    btn.setAttribute('data-store', 'counter')
    btn.setAttribute('data-mutation', 'increment')
    btn.setAttribute('data-args', '{"amount":1}')
    root.appendChild(btn)

    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(btn.classList.contains('is-pending')).toBe(true)

    resolveMutation()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(btn.classList.contains('is-pending')).toBe(false)
    handle.destroy()
  })

  it('removes is-pending on mutation error', async () => {
    const mutate = vi.fn().mockResolvedValue({ isOk: () => false, isErr: () => true })
    const stores = {
      counter: { mutations: { fail: mutate }, signals: {} }
    }

    const handle = initMutationDelegation(root, stores)

    const btn = document.createElement('button')
    btn.setAttribute('data-store', 'counter')
    btn.setAttribute('data-mutation', 'fail')
    btn.setAttribute('data-args', '{}')
    root.appendChild(btn)

    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(btn.classList.contains('is-pending')).toBe(false)
    handle.destroy()
  })

  it('ignores clicks on elements without data-mutation', async () => {
    const mutate = vi.fn()
    const stores = { counter: { mutations: { increment: mutate }, signals: {} } }

    const handle = initMutationDelegation(root, stores)

    const btn = document.createElement('button')
    root.appendChild(btn)
    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(mutate).not.toHaveBeenCalled()
    handle.destroy()
  })

  it('ignores clicks with unknown store slug', async () => {
    const mutate = vi.fn()
    const stores = { counter: { mutations: { increment: mutate }, signals: {} } }

    const handle = initMutationDelegation(root, stores)

    const btn = document.createElement('button')
    btn.setAttribute('data-store', 'unknown')
    btn.setAttribute('data-mutation', 'increment')
    btn.setAttribute('data-args', '{}')
    root.appendChild(btn)

    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(mutate).not.toHaveBeenCalled()
    handle.destroy()
  })

  it('bubbles from child element to data-mutation ancestor', async () => {
    const mutate = vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false })
    const stores = { counter: { mutations: { increment: mutate }, signals: {} } }

    const handle = initMutationDelegation(root, stores)

    const btn = document.createElement('button')
    btn.setAttribute('data-store', 'counter')
    btn.setAttribute('data-mutation', 'increment')
    btn.setAttribute('data-args', '{"amount":1}')
    const span = document.createElement('span')
    span.textContent = 'Click me'
    btn.appendChild(span)
    root.appendChild(btn)

    span.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(mutate).toHaveBeenCalledWith({ amount: 1 })
    handle.destroy()
  })

  it('default data-args to empty object when not present', async () => {
    const mutate = vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false })
    const stores = { counter: { mutations: { reset: mutate }, signals: {} } }

    const handle = initMutationDelegation(root, stores)

    const btn = document.createElement('button')
    btn.setAttribute('data-store', 'counter')
    btn.setAttribute('data-mutation', 'reset')
    root.appendChild(btn)

    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(mutate).toHaveBeenCalledWith({})
    handle.destroy()
  })

  it('destroy stops listening', async () => {
    const mutate = vi.fn()
    const stores = { counter: { mutations: { increment: mutate }, signals: {} } }

    const handle = initMutationDelegation(root, stores)
    handle.destroy()

    const btn = document.createElement('button')
    btn.setAttribute('data-store', 'counter')
    btn.setAttribute('data-mutation', 'increment')
    btn.setAttribute('data-args', '{}')
    root.appendChild(btn)

    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(mutate).not.toHaveBeenCalled()
  })
})
