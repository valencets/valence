// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { initLoginForm } from '../admin/editor/login-reactive.js'

describe('login-reactive', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function createLoginForm (): HTMLFormElement {
    document.body.innerHTML = `
      <form method="POST" action="/admin/login">
        <input type="hidden" name="_csrf" value="tok">
        <input name="email" type="email" required>
        <input name="password" type="password" required>
        <button type="submit" class="km-gradient-btn">Sign In</button>
      </form>
    `
    return document.querySelector('form')!
  }

  it('disables submit button when fields are empty', () => {
    const form = createLoginForm()
    const bindings = initLoginForm(form)
    expect(bindings).not.toBeNull()
    const btn = form.querySelector<HTMLButtonElement>('button')!
    expect(btn.disabled).toBe(true)
    bindings!.dispose()
  })

  it('enables submit button when both signals have values', () => {
    const form = createLoginForm()
    const bindings = initLoginForm(form)!
    const btn = form.querySelector<HTMLButtonElement>('button')!

    bindings.signals.email.value = 'test@test.com'
    bindings.signals.password.value = 'secret'

    expect(btn.disabled).toBe(false)
    bindings.dispose()
  })

  it('disables button again when a signal is cleared', () => {
    const form = createLoginForm()
    const bindings = initLoginForm(form)!
    const btn = form.querySelector<HTMLButtonElement>('button')!

    bindings.signals.email.value = 'a@b.c'
    bindings.signals.password.value = 'x'
    expect(btn.disabled).toBe(false)

    bindings.signals.email.value = ''
    expect(btn.disabled).toBe(true)
    bindings.dispose()
  })

  it('returns a dispose function that cleans up all bindings', () => {
    const form = createLoginForm()
    const bindings = initLoginForm(form)!
    const btn = form.querySelector<HTMLButtonElement>('button')!

    bindings.dispose()

    bindings.signals.email.value = 'after@dispose.com'
    bindings.signals.password.value = 'x'
    expect(btn.disabled).toBe(true)
  })

  it('returns null when required elements are missing', () => {
    document.body.innerHTML = '<form><button type="submit">Go</button></form>'
    const form = document.querySelector('form')!
    expect(initLoginForm(form)).toBeNull()
  })
})
