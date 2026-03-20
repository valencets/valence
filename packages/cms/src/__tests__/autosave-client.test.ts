// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'

describe('autosave-client module exports', () => {
  it('exports initAutosave function', async () => {
    const mod = await import('../admin/editor/autosave-client.js')
    expect(typeof mod.initAutosave).toBe('function')
  })
})

describe('initAutosave()', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('does nothing when indicator has no data-autosave-endpoint', async () => {
    const { initAutosave } = await import('../admin/editor/autosave-client.js')
    document.body.innerHTML = `
      <form class="admin-form">
        <input type="hidden" name="_csrf" value="tok">
        <input name="title" value="">
      </form>
      <span class="autosave-indicator">Saved</span>
    `
    const form = document.querySelector<HTMLFormElement>('.admin-form')!
    const indicator = document.querySelector<HTMLElement>('.autosave-indicator')!
    // Should not throw even without endpoint
    initAutosave(form, indicator)
    expect(indicator.textContent).toBe('Saved')
  })

  it('sets indicator to "Unsaved changes" on form input', async () => {
    const { initAutosave } = await import('../admin/editor/autosave-client.js')
    document.body.innerHTML = `
      <form class="admin-form">
        <input type="hidden" name="_csrf" value="tok">
        <input name="title" value="">
      </form>
      <span class="autosave-indicator" data-autosave-endpoint="/admin/posts/1/autosave">Saved</span>
    `
    const form = document.querySelector<HTMLFormElement>('.admin-form')!
    const indicator = document.querySelector<HTMLElement>('.autosave-indicator')!
    initAutosave(form, indicator)

    const titleInput = form.querySelector<HTMLInputElement>('input[name="title"]')!
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))

    expect(indicator.textContent).toBe('Unsaved changes')
  })

  it('has autosave-state data attribute on indicator after input', async () => {
    const { initAutosave } = await import('../admin/editor/autosave-client.js')
    document.body.innerHTML = `
      <form class="admin-form">
        <input type="hidden" name="_csrf" value="tok">
        <input name="title" value="">
      </form>
      <span class="autosave-indicator" data-autosave-endpoint="/admin/posts/1/autosave">Saved</span>
    `
    const form = document.querySelector<HTMLFormElement>('.admin-form')!
    const indicator = document.querySelector<HTMLElement>('.autosave-indicator')!
    initAutosave(form, indicator)

    const titleInput = form.querySelector<HTMLInputElement>('input[name="title"]')!
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))

    expect(indicator.dataset['autosaveState']).toBe('unsaved')
  })
})
