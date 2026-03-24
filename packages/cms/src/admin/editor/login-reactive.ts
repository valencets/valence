// Login form reactive bindings — powered by @valencets/reactive
// Hydrates server-rendered login form with client-side validation and state.
// Works with both <input> and <val-input> elements (duck-typed .value access).

import { signal, computed, effect } from '@valencets/reactive'
import type { Signal } from '@valencets/reactive'

/** Element with a string value property — matches HTMLInputElement and ValInput */
interface ValueElement extends HTMLElement {
  value: string
}

function hasValue (el: Element): el is ValueElement {
  return 'value' in el
}

export interface LoginFormBindings {
  readonly dispose: () => void
  readonly signals: { email: Signal<string>, password: Signal<string> }
}

/** Initialize reactive bindings on the login form. Returns bindings with dispose + signals. */
export function initLoginForm (form: HTMLFormElement): LoginFormBindings | null {
  const emailEl = form.querySelector('[name="email"]')
  const passwordEl = form.querySelector('[name="password"]')
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')

  if (!emailEl || !passwordEl || !submitBtn || !hasValue(emailEl) || !hasValue(passwordEl)) return null

  const email = signal(emailEl.value)
  const password = signal(passwordEl.value)
  const canSubmit = computed(() => email.value.length > 0 && password.value.length > 0)

  const disposers: Array<() => void> = []

  // Two-way: input events → signals (native input events cross shadow DOM boundary)
  const onEmail = (): void => { email.value = emailEl.value }
  const onPassword = (): void => { password.value = passwordEl.value }
  emailEl.addEventListener('input', onEmail)
  passwordEl.addEventListener('input', onPassword)
  disposers.push(() => { emailEl.removeEventListener('input', onEmail) })
  disposers.push(() => { passwordEl.removeEventListener('input', onPassword) })

  // One-way: canSubmit signal → button disabled
  disposers.push(effect(() => {
    submitBtn.disabled = !canSubmit.value
  }))

  const dispose = (): void => {
    for (const d of disposers) {
      d()
    }
  }

  return { dispose, signals: { email, password } }
}
