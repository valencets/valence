import { describe, it, expect, vi, afterEach } from 'vitest'
import { signal, computed, effect, batch, untracked } from '../core.js'
import { bind } from '../bind.js'
import { fieldSink, condition } from '../sinks.js'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('integration: CMS form scenario', () => {
  it('three fields with conditional visibility and autosave', () => {
    // Simulate a CMS edit form: title, slug (auto-generated), body (conditionally visible)
    const title = fieldSink('')
    const slug = fieldSink('')
    const body = fieldSink('')

    // Slug auto-generates from title
    const autoSlug = computed(() =>
      title.value.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    )
    effect(() => { slug.value.value = autoSlug.value })

    // Body visible only when title is non-empty
    const showBody = condition([title.value], (t) => t.length > 0)
    effect(() => { body.visible.value = showBody.value })

    // Autosave effect — collects form state on change
    const saves: Array<{ title: string, slug: string, body: string }> = []
    const autosave = effect(() => {
      const t = title.value.value
      const s = slug.value.value
      const b = body.value.value
      if (t.length > 0) {
        saves.push({ title: t, slug: s, body: b })
      }
    })

    // Initial state
    expect(body.visible.value).toBe(false)
    expect(saves).toHaveLength(0)

    // User types a title
    title.value.value = 'Hello World'
    expect(slug.value.value).toBe('hello-world')
    expect(body.visible.value).toBe(true)
    expect(saves.length).toBeGreaterThan(0)
    expect(saves[saves.length - 1]!.slug).toBe('hello-world')

    // User edits body
    body.value.value = 'Some content'
    const lastSave = saves[saves.length - 1]!
    expect(lastSave.body).toBe('Some content')

    // Clean up
    autosave()
  })

  it('batch reduces effect executions', () => {
    const firstName = signal('')
    const lastName = signal('')
    const fullName = computed(() => `${firstName.value} ${lastName.value}`.trim())
    const spy = vi.fn()
    const dispose = effect(() => { spy(fullName.value) })
    spy.mockClear()

    // Without batch: 2 effect runs
    firstName.value = 'John'
    lastName.value = 'Doe'
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockClear()

    // With batch: 1 effect run
    batch(() => {
      firstName.value = 'Jane'
      lastName.value = 'Smith'
    })
    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith('Jane Smith')
    dispose()
  })

  it('DOM hydration with bind + signals', () => {
    const nameInput = document.createElement('input')
    const greeting = document.createElement('span')
    const submitBtn = document.createElement('input')
    submitBtn.type = 'submit'
    document.body.append(nameInput, greeting, submitBtn)

    const name = signal('')
    const greetingText = computed(() => name.value ? `Hello, ${name.value}!` : '')
    const canSubmit = computed(() => name.value.length > 0)

    const d1 = bind(nameInput, { value: name })
    const d2 = bind(greeting, { text: greetingText })
    const d3 = bind(submitBtn, { disabled: computed(() => !canSubmit.value) })

    expect(greeting.textContent).toBe('')
    expect(submitBtn.disabled).toBe(true)

    // Simulate user typing
    nameInput.value = 'Valence'
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))

    expect(name.value).toBe('Valence')
    expect(greeting.textContent).toBe('Hello, Valence!')
    expect(submitBtn.disabled).toBe(false)

    // Cleanup
    d1()
    d2()
    d3()

    // After dispose, signals don't update DOM
    name.value = 'Gone'
    expect(greeting.textContent).toBe('Hello, Valence!')
  })

  it('memory cleanup — dispose removes all subscriptions', () => {
    const signals = Array.from({ length: 10 }, (_, i) => signal(i))
    const computeds = signals.map((s, i) => computed(() => s.value * (i + 1)))
    const results: number[] = []

    const dispose = effect(() => {
      results.length = 0
      for (const c of computeds) {
        results.push(c.value)
      }
    })

    expect(results).toHaveLength(10)
    expect(results[0]).toBe(0)
    expect(results[9]).toBe(90)

    // Update one signal
    signals[5]!.value = 100
    expect(results[5]).toBe(600)

    // Dispose — updates should stop
    dispose()
    const snapshot = [...results]
    signals[0]!.value = 999
    expect(results).toEqual(snapshot)
  })

  it('untracked reads do not create dependencies', () => {
    const tracked = signal(0)
    const hidden = signal('secret')
    const spy = vi.fn()

    const dispose = effect(() => {
      const t = tracked.value
      const h = untracked(() => hidden.value)
      spy(`${t}:${h}`)
    })

    expect(spy).toHaveBeenCalledWith('0:secret')
    spy.mockClear()

    hidden.value = 'changed' // untracked — no re-run
    expect(spy).not.toHaveBeenCalled()

    tracked.value = 1 // tracked — re-runs, picks up new hidden value
    expect(spy).toHaveBeenCalledWith('1:changed')

    dispose()
  })
})
