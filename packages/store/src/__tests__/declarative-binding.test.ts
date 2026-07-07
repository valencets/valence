// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initStores } from '../client/bootstrap.js'
import type { StoresHandle } from '../client/bootstrap.js'
import { field } from '../fields/index.js'
import type { StoreInput, StoreValue } from '../types.js'

interface RecordedCall {
  readonly slug: string
  readonly mutation: string
  readonly args: { [key: string]: StoreValue }
}

function prefsStore (): StoreInput {
  return {
    slug: 'prefs',
    scope: 'session',
    fields: [
      field.number({ name: 'volume', default: 5 }),
      field.text({ name: 'label', default: 'hi' }),
      field.boolean({ name: 'muted', default: false })
    ],
    mutations: {
      update: {
        input: [
          field.number({ name: 'volume' }),
          field.text({ name: 'label' }),
          field.boolean({ name: 'muted' })
        ],
        server: async () => {}
      },
      reset: {
        input: [],
        server: async () => {}
      }
    },
    fragment: (state) => `<b class="vol">${String(state.volume)}</b>`
  }
}

function mountPage (): void {
  document.body.innerHTML = `
    <section data-store="prefs">
      <fieldset data-commit="update">
        <input data-field="volume" type="number">
        <input data-field="label" type="text">
        <input data-field="muted" type="checkbox">
      </fieldset>
      <input data-field="label" id="orphan" type="text">
      <button data-mutation="reset">Reset</button>
      <div data-fragment="" id="preview"><span>loading</span></div>
      <p id="bystander">untouched</p>
    </section>
  `
}

describe('declarative binding', () => {
  let calls: RecordedCall[]
  let handle: StoresHandle | null = null

  const transport = async (slug: string, mutation: string, args: { [key: string]: StoreValue }, mutationId: number) => {
    calls.push({ slug, mutation, args })
    return {
      ok: true,
      state: { volume: 5, label: 'hi', muted: false },
      confirmedId: mutationId
    }
  }

  beforeEach(() => {
    calls = []
    mountPage()
  })

  afterEach(() => {
    handle?.dispose()
    handle = null
    document.body.innerHTML = ''
  })

  function boot (): StoresHandle {
    handle = initStores([prefsStore()], { postMutation: transport })
    return handle
  }

  function input (selector: string): HTMLInputElement {
    return document.querySelector(selector) as HTMLInputElement
  }

  it('seeds data-field controls from store signals at boot', () => {
    boot()
    expect(input('[data-field="volume"]').value).toBe('5')
    expect(input('fieldset [data-field="label"]').value).toBe('hi')
    expect(input('[data-field="muted"]').checked).toBe(false)
  })

  it('renders the initial fragment into data-fragment targets without touching siblings', () => {
    boot()
    const preview = document.getElementById('preview')!
    expect(preview.innerHTML).toBe('<b class="vol">5</b>')
    expect(document.getElementById('bystander')!.textContent).toBe('untouched')
  })

  it('commits field edits through the data-commit mutation with schema coercion', async () => {
    boot()
    const volume = input('[data-field="volume"]')
    volume.value = '7'
    volume.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(calls).toContainEqual({ slug: 'prefs', mutation: 'update', args: { volume: 7 } })
  })

  it('commits boolean fields from checked state', async () => {
    boot()
    const muted = input('[data-field="muted"]')
    muted.checked = true
    muted.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(calls).toContainEqual({ slug: 'prefs', mutation: 'update', args: { muted: true } })
  })

  it('debounces input events and commits once', async () => {
    vi.useFakeTimers()
    boot()
    const label = input('fieldset [data-field="label"]')
    label.value = 'y'
    label.dispatchEvent(new Event('input', { bubbles: true }))
    label.value = 'yo'
    label.dispatchEvent(new Event('input', { bubbles: true }))

    await vi.advanceTimersByTimeAsync(400)
    vi.useRealTimers()

    const labelCalls = calls.filter(c => 'label' in c.args)
    expect(labelCalls).toHaveLength(1)
    expect(labelCalls[0]!.args).toEqual({ label: 'yo' })
  })

  it('field edits without a data-commit ancestor never mutate', async () => {
    boot()
    const orphan = input('#orphan')
    orphan.value = 'nope'
    orphan.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(calls).toHaveLength(0)
  })

  it('click triggers inherit the store from the nearest data-store ancestor', async () => {
    boot()
    const button = document.querySelector('[data-mutation="reset"]') as HTMLButtonElement
    button.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(calls).toContainEqual({ slug: 'prefs', mutation: 'reset', args: {} })
  })

  it('repaints unfocused controls when authoritative state arrives', () => {
    const booted = boot()
    booted.stores.prefs!.applyServerState({ volume: 9, label: 'server', muted: true })

    expect(input('[data-field="volume"]').value).toBe('9')
    expect(input('fieldset [data-field="label"]').value).toBe('server')
    expect(input('[data-field="muted"]').checked).toBe(true)
  })

  it('never clobbers the control the user is typing in', () => {
    const booted = boot()
    const label = input('fieldset [data-field="label"]')
    label.focus()
    label.value = 'typing…'

    booted.stores.prefs!.applyServerState({ volume: 9, label: 'server', muted: false })

    expect(label.value).toBe('typing…')
    expect(input('[data-field="volume"]').value).toBe('9')
  })
})
