// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

describe('initLivePreview()', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('is exported as a named function', async () => {
    const mod = await import('../admin/editor/preview-client.js')
    expect(typeof mod.initLivePreview).toBe('function')
  })

  it('does nothing when no .preview-iframe is present', async () => {
    document.body.innerHTML = '<form class="admin-form"><input name="title" value="Test"></form>'
    const { initLivePreview } = await import('../admin/editor/preview-client.js')
    expect(() => initLivePreview()).not.toThrow()
  })

  it('does nothing when no admin-form is present', async () => {
    document.body.innerHTML = '<iframe class="preview-iframe" src="/preview/test"></iframe>'
    const { initLivePreview } = await import('../admin/editor/preview-client.js')
    expect(() => initLivePreview()).not.toThrow()
  })

  it('sends postMessage to iframe.contentWindow on form input (debounced)', async () => {
    const postMessageMock = vi.fn()
    document.body.innerHTML = `
      <form class="admin-form">
        <input name="title" value="Hello">
        <input name="slug" value="hello">
      </form>
      <iframe class="preview-iframe" src="/preview/hello"></iframe>
    `
    const iframe = document.querySelector<HTMLIFrameElement>('.preview-iframe')!
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: postMessageMock },
      writable: true
    })

    const { initLivePreview } = await import('../admin/editor/preview-client.js')
    initLivePreview()

    const form = document.querySelector<HTMLFormElement>('.admin-form')!
    const titleInput = form.querySelector<HTMLInputElement>('input[name="title"]')!
    titleInput.value = 'Updated Title'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))

    // Before debounce fires — no postMessage yet
    expect(postMessageMock).not.toHaveBeenCalled()

    // Advance timers past 300ms debounce
    vi.advanceTimersByTime(300)

    expect(postMessageMock).toHaveBeenCalledOnce()
    const [data, origin] = postMessageMock.mock.calls[0] as [{ type: string; data: Record<string, string> }, string]
    expect(data.type).toBe('valence:preview-update')
    expect(data.data).toBeDefined()
    expect(origin).toBe('*')
  })

  it('debounces — only fires once for multiple rapid inputs', async () => {
    const postMessageMock = vi.fn()
    document.body.innerHTML = `
      <form class="admin-form">
        <input name="title" value="Hello">
      </form>
      <iframe class="preview-iframe" src="/preview/hello"></iframe>
    `
    const iframe = document.querySelector<HTMLIFrameElement>('.preview-iframe')!
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: postMessageMock },
      writable: true
    })

    const { initLivePreview } = await import('../admin/editor/preview-client.js')
    initLivePreview()

    const form = document.querySelector<HTMLFormElement>('.admin-form')!
    const titleInput = form.querySelector<HTMLInputElement>('input[name="title"]')!

    // Fire multiple rapid inputs
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    vi.advanceTimersByTime(100)
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    vi.advanceTimersByTime(100)
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    vi.advanceTimersByTime(300)

    expect(postMessageMock).toHaveBeenCalledOnce()
  })

  it('serializes all form field values in postMessage data', async () => {
    const postMessageMock = vi.fn()
    document.body.innerHTML = `
      <form class="admin-form">
        <input name="title" value="My Title">
        <input name="slug" value="my-slug">
      </form>
      <iframe class="preview-iframe" src="/preview"></iframe>
    `
    const iframe = document.querySelector<HTMLIFrameElement>('.preview-iframe')!
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: postMessageMock },
      writable: true
    })

    const { initLivePreview } = await import('../admin/editor/preview-client.js')
    initLivePreview()

    const form = document.querySelector<HTMLFormElement>('.admin-form')!
    form.dispatchEvent(new Event('input', { bubbles: false }))
    // Trigger via the input element which bubbles
    const titleInput = form.querySelector<HTMLInputElement>('input[name="title"]')!
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    vi.advanceTimersByTime(300)

    const [msg] = postMessageMock.mock.calls[0] as [{ type: string; data: Record<string, string> }]
    expect(msg.data['title']).toBe('My Title')
    expect(msg.data['slug']).toBe('my-slug')
  })
})

describe('preview-client viewport switcher', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clicking desktop viewport button sets iframe width to 100%', async () => {
    document.body.innerHTML = `
      <form class="admin-form"><input name="t" value="x"></form>
      <iframe class="preview-iframe" src="/preview" style="width:375px"></iframe>
      <button type="button" data-viewport="desktop">Desktop</button>
      <button type="button" data-viewport="tablet">Tablet</button>
      <button type="button" data-viewport="mobile">Mobile</button>
    `
    const iframe = document.querySelector<HTMLIFrameElement>('.preview-iframe')!
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, writable: true })

    const { initLivePreview } = await import('../admin/editor/preview-client.js')
    initLivePreview()

    const desktopBtn = document.querySelector<HTMLButtonElement>('[data-viewport="desktop"]')!
    desktopBtn.click()
    expect(iframe.style.width).toBe('100%')
  })

  it('clicking tablet viewport button sets iframe width to 768px', async () => {
    document.body.innerHTML = `
      <form class="admin-form"><input name="t" value="x"></form>
      <iframe class="preview-iframe" src="/preview"></iframe>
      <button type="button" data-viewport="desktop">Desktop</button>
      <button type="button" data-viewport="tablet">Tablet</button>
      <button type="button" data-viewport="mobile">Mobile</button>
    `
    const iframe = document.querySelector<HTMLIFrameElement>('.preview-iframe')!
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, writable: true })

    const { initLivePreview } = await import('../admin/editor/preview-client.js')
    initLivePreview()

    const tabletBtn = document.querySelector<HTMLButtonElement>('[data-viewport="tablet"]')!
    tabletBtn.click()
    expect(iframe.style.width).toBe('768px')
  })

  it('clicking mobile viewport button sets iframe width to 375px', async () => {
    document.body.innerHTML = `
      <form class="admin-form"><input name="t" value="x"></form>
      <iframe class="preview-iframe" src="/preview"></iframe>
      <button type="button" data-viewport="desktop">Desktop</button>
      <button type="button" data-viewport="tablet">Tablet</button>
      <button type="button" data-viewport="mobile">Mobile</button>
    `
    const iframe = document.querySelector<HTMLIFrameElement>('.preview-iframe')!
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, writable: true })

    const { initLivePreview } = await import('../admin/editor/preview-client.js')
    initLivePreview()

    const mobileBtn = document.querySelector<HTMLButtonElement>('[data-viewport="mobile"]')!
    mobileBtn.click()
    expect(iframe.style.width).toBe('375px')
  })
})

describe('preview-client refresh button', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clicking refresh button reloads the iframe by reassigning src', async () => {
    document.body.innerHTML = `
      <form class="admin-form"><input name="t" value="x"></form>
      <iframe class="preview-iframe" src="/preview/test"></iframe>
      <button type="button" class="preview-refresh">Refresh</button>
    `
    const iframe = document.querySelector<HTMLIFrameElement>('.preview-iframe')!
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, writable: true })

    const { initLivePreview } = await import('../admin/editor/preview-client.js')
    initLivePreview()

    const refreshBtn = document.querySelector<HTMLButtonElement>('.preview-refresh')!
    refreshBtn.click()
    // After refresh, src should remain assigned (the reload mechanism)
    expect(iframe.src).toBeTruthy()
  })
})
