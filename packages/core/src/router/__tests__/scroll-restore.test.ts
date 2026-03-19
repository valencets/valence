import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initScrollRestore } from '../scroll-restore.js'

describe('initScrollRestore', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('saveCurrentPosition calls replaceState with scroll values', () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')

    vi.stubGlobal('scrollX', 100)
    vi.stubGlobal('scrollY', 250)

    const handle = initScrollRestore()
    handle.saveCurrentPosition()

    expect(replaceStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ scrollX: 100, scrollY: 250 }),
      ''
    )

    replaceStateSpy.mockRestore()
    vi.unstubAllGlobals()
    handle.destroy()
  })

  it('saveCurrentPosition preserves existing state', () => {
    window.history.replaceState({ url: '/about' }, '', '/about')
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')

    vi.stubGlobal('scrollX', 0)
    vi.stubGlobal('scrollY', 300)

    const handle = initScrollRestore()
    handle.saveCurrentPosition()

    expect(replaceStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/about', scrollX: 0, scrollY: 300 }),
      ''
    )

    replaceStateSpy.mockRestore()
    vi.unstubAllGlobals()
    handle.destroy()
  })

  it('restorePosition calls scrollTo with state values', () => {
    window.history.replaceState({ scrollX: 50, scrollY: 400 }, '', '/')
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    const handle = initScrollRestore()
    handle.restorePosition()

    expect(scrollToSpy).toHaveBeenCalledWith(50, 400)

    scrollToSpy.mockRestore()
    handle.destroy()
  })

  it('restorePosition no-ops when state has no scroll values', () => {
    window.history.replaceState({ url: '/page' }, '', '/')
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    const handle = initScrollRestore()
    handle.restorePosition()

    expect(scrollToSpy).not.toHaveBeenCalled()

    scrollToSpy.mockRestore()
    handle.destroy()
  })

  it('restorePosition no-ops when state is null', () => {
    window.history.replaceState(null, '', '/')
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    const handle = initScrollRestore()
    handle.restorePosition()

    expect(scrollToSpy).not.toHaveBeenCalled()

    scrollToSpy.mockRestore()
    handle.destroy()
  })

  it('scrollToHash finds element and calls scrollIntoView', () => {
    const target = document.createElement('div')
    target.id = 'section-1'
    document.body.appendChild(target)
    const scrollIntoViewSpy = vi.spyOn(target, 'scrollIntoView').mockImplementation(() => {})

    const handle = initScrollRestore()
    const result = handle.scrollToHash('#section-1')

    expect(result).toBe(true)
    expect(scrollIntoViewSpy).toHaveBeenCalled()

    scrollIntoViewSpy.mockRestore()
    handle.destroy()
  })

  it('scrollToHash returns false for missing element', () => {
    const handle = initScrollRestore()
    const result = handle.scrollToHash('#nonexistent')

    expect(result).toBe(false)
    handle.destroy()
  })

  it('scrollToHash handles empty string', () => {
    const handle = initScrollRestore()
    const result = handle.scrollToHash('')

    expect(result).toBe(false)
    handle.destroy()
  })
})
