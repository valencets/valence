import { fromThrowable } from 'neverthrow'
import { getCsrfToken } from './fragment-swap.js'

export interface FormEnhanceConfig {
  readonly onNavigate?: ((url: string) => void) | undefined
}

export interface FormEnhanceHandle {
  readonly destroy: () => void
}

export function shouldEnhanceForm (form: HTMLFormElement): boolean {
  if (form.hasAttribute('data-val-enhance')) return true
  if (form.closest('val-outlet') !== null) return true
  return false
}

export function serializeForm (form: HTMLFormElement): URLSearchParams {
  const params = new URLSearchParams()
  const data = new FormData(form)
  for (const [key, value] of data.entries()) {
    if (typeof value === 'string') {
      params.append(key, value)
    }
  }
  return params
}

function csrfHeaders (): Record<string, string> {
  const token = getCsrfToken()
  if (token === undefined) return {}
  return { 'X-CSRF-Token': token }
}

const safeNewUrl = fromThrowable((action: string) => new URL(action), () => null)

function resolveFormUrl (form: HTMLFormElement): string {
  const action = form.action
  if (action === '' || action === undefined) return window.location.pathname
  const result = safeNewUrl(action)
  if (result.isErr() || result.value === null) return action
  return result.value.pathname + result.value.search
}

function handleRedirect (response: Response, config: FormEnhanceConfig): void {
  const location = response.headers.get('Location')
  if (location === null) return
  if (config.onNavigate !== undefined) {
    config.onNavigate(location)
  } else {
    window.location.href = location
  }
}

function onSubmit (
  event: Event,
  config: FormEnhanceConfig,
  fetchFn: typeof fetch
): void {
  const target = event.target as HTMLElement | null
  if (target === null) return

  const form = target instanceof HTMLFormElement ? target : target.closest('form')
  if (form === null) return

  if (!shouldEnhanceForm(form)) return

  event.preventDefault()

  const url = resolveFormUrl(form)
  const method = (form.method || 'POST').toUpperCase()
  const body = serializeForm(form).toString()

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Valence-Fragment': 'true',
    ...csrfHeaders()
  }

  fetchFn(url, { method, headers, body })
    .then((response) => {
      if (response.status === 302 || (response.status >= 300 && response.status < 400)) {
        handleRedirect(response, config)
      }
      // Success — no further action needed for now (fragment swap handled by router)
    })
    .catch(() => {
      // Fetch errors are silently ignored — form degrades gracefully
    })
}

export function initFormEnhancement (
  config: FormEnhanceConfig | undefined,
  fetchFn: typeof fetch = globalThis.fetch
): FormEnhanceHandle {
  const resolvedConfig: FormEnhanceConfig = config ?? {}

  const listener = (event: Event): void => {
    onSubmit(event, resolvedConfig, fetchFn)
  }

  document.body.addEventListener('submit', listener)

  return {
    destroy () {
      document.body.removeEventListener('submit', listener)
    }
  }
}
