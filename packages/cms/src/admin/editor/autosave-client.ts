/** Debounce delay in ms before sending autosave request */
const AUTOSAVE_DEBOUNCE_MS = 800

const AUTOSAVE_STATES = {
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving...',
  error: 'Save failed'
} as const

type AutosaveState = keyof typeof AUTOSAVE_STATES

function setIndicatorState (indicator: HTMLElement, state: AutosaveState, timestamp?: string): void {
  const label = AUTOSAVE_STATES[state]
  indicator.textContent = state === 'saved' && timestamp
    ? `Saved at ${timestamp}`
    : label
  indicator.dataset['autosaveState'] = state
}

function buildFormBody (form: HTMLFormElement): string {
  const formData = new FormData(form)
  const params = new URLSearchParams()
  for (const [key, val] of formData.entries()) {
    if (typeof val === 'string') params.append(key, val)
  }
  return params.toString()
}

function sendAutosave (endpoint: string, body: string): Promise<string> {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  }).then((res) => {
    if (!res.ok) return Promise.reject(new Error(`HTTP ${res.status}`))
    return res.json() as Promise<{ success: boolean; savedAt?: string }>
  }).then((json) => {
    if (!json.success) return Promise.reject(new Error('Autosave failed'))
    return json.savedAt ?? new Date().toISOString()
  })
}

function formatTime (isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function initAutosave (form: HTMLFormElement, indicator: HTMLElement): void {
  const endpoint = indicator.dataset['autosaveEndpoint']
  if (!endpoint) return

  let timer: ReturnType<typeof setTimeout> | null = null

  const triggerSave = (): void => {
    if (timer !== null) clearTimeout(timer)
    setIndicatorState(indicator, 'unsaved')
    timer = setTimeout(() => {
      setIndicatorState(indicator, 'saving')
      const body = buildFormBody(form)
      sendAutosave(endpoint, body)
        .then((savedAt) => {
          setIndicatorState(indicator, 'saved', formatTime(savedAt))
        })
        .catch(() => {
          setIndicatorState(indicator, 'error')
        })
    }, AUTOSAVE_DEBOUNCE_MS)
  }

  form.addEventListener('input', triggerSave)
}
