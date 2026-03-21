import { ValElement } from '../core/val-element.js'

const AUTOSAVE_STATES = {
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving\u2026',
  error: 'Save failed'
} as const

type AutosaveState = keyof typeof AUTOSAVE_STATES

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host { display: inline-block; font-family: var(--val-font-sans); font-size: var(--val-text-sm); }
  .status { transition: color var(--val-duration-fast) var(--val-ease-in-out); }
  :host([data-state="saved"]) .status { color: var(--val-color-success); }
  :host([data-state="unsaved"]) .status { color: var(--val-color-text-muted); }
  :host([data-state="saving"]) .status { color: var(--val-color-text-muted); }
  :host([data-state="error"]) .status { color: var(--val-color-error); }
</style>
<span class="status" role="status" aria-live="polite"></span>
`

function buildFormBody (form: HTMLFormElement, csrfToken: string): string {
  const formData = new FormData(form)
  const params = new URLSearchParams()
  for (const [key, val] of formData.entries()) {
    if (typeof val === 'string') params.append(key, val)
  }
  params.set('_csrf', csrfToken)
  return params.toString()
}

function formatTime (isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export class ValAutosave extends ValElement {
  static observedAttributes = ['endpoint', 'debounce-ms', 'csrf-token']

  private statusEl: HTMLElement | null = null
  private form: HTMLFormElement | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private currentState: AutosaveState = 'saved'

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  connectedCallback (): void {
    super.connectedCallback()
    this.statusEl = this.shadowRoot!.querySelector('.status')
    this.form = this.closest('form')
    this.setState('saved')
    this.form?.addEventListener('input', this.handleInput)
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.form?.removeEventListener('input', this.handleInput)
    if (this.timer !== null) clearTimeout(this.timer)
  }

  get endpoint (): string {
    return this.getAttribute('endpoint') ?? ''
  }

  get debounceMs (): number {
    const raw = this.getAttribute('debounce-ms')
    if (raw === null) return 800
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : 800
  }

  get csrfToken (): string {
    return this.getAttribute('csrf-token') ?? ''
  }

  get state (): AutosaveState {
    return this.currentState
  }

  private setState (state: AutosaveState, timestamp?: string): void {
    this.currentState = state
    this.setAttribute('data-state', state)
    if (this.statusEl !== null) {
      this.statusEl.textContent = state === 'saved' && timestamp !== undefined
        ? `Saved at ${timestamp}`
        : AUTOSAVE_STATES[state]
    }
    this.emitInteraction('state-change', { state })
  }

  private handleInput = (): void => {
    if (this.timer !== null) clearTimeout(this.timer)
    this.setState('unsaved')
    this.timer = setTimeout(() => {
      this.save()
    }, this.debounceMs)
  }

  private save (): void {
    const endpoint = this.endpoint
    const form = this.form
    if (!endpoint || form === null) return
    this.setState('saving')
    const body = buildFormBody(form, this.csrfToken)
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    }).then((res) => {
      if (!res.ok) return { success: false } as { success: boolean; savedAt?: string }
      return res.json() as Promise<{ success: boolean; savedAt?: string }>
    }).then((json) => {
      if (!json.success) {
        this.setState('error')
        return
      }
      const savedAt = json.savedAt ?? new Date().toISOString()
      this.setState('saved', formatTime(savedAt))
    }, () => {
      this.setState('error')
    })
  }
}
