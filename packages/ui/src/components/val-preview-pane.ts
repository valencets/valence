import { ValElement } from '../core/val-element.js'

const VIEWPORT_WIDTHS: Readonly<Record<string, string>> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px'
}

const DEBOUNCE_MS = 300

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host {
    display: block;
    font-family: var(--val-font-sans);
  }
  .toolbar {
    display: flex;
    gap: var(--val-space-2, 0.5rem);
    padding: var(--val-space-2, 0.5rem) 0;
  }
  .toolbar button {
    background: var(--val-color-bg-muted);
    border: 1px solid var(--val-color-border);
    border-radius: var(--val-radius-md);
    padding: var(--val-space-1, 0.25rem) var(--val-space-2, 0.5rem);
    color: var(--val-color-text-muted);
    font-size: var(--val-text-xs);
    font-family: var(--val-font-sans);
    cursor: pointer;
    transition: border-color var(--val-duration-fast) var(--val-ease-in-out);
  }
  .toolbar button:hover {
    border-color: var(--val-color-border-focus);
    color: var(--val-color-text);
  }
  .toolbar button[aria-pressed="true"] {
    border-color: var(--val-color-border-focus);
    color: var(--val-color-text);
  }
  iframe {
    border: 1px solid var(--val-color-border);
    border-radius: var(--val-radius-md);
    background: white;
    width: 100%;
    height: 400px;
    transition: width var(--val-duration-normal) var(--val-ease-in-out);
  }
</style>
<div class="toolbar">
  <button type="button" data-viewport="desktop" aria-pressed="true">Desktop</button>
  <button type="button" data-viewport="tablet" aria-pressed="false">Tablet</button>
  <button type="button" data-viewport="mobile" aria-pressed="false">Mobile</button>
  <button type="button" class="refresh">Refresh</button>
</div>
<iframe sandbox="allow-scripts allow-same-origin"></iframe>
`

function serializeForm (form: HTMLFormElement): Record<string, string> {
  const data: Record<string, string> = {}
  const formData = new FormData(form)
  for (const [key, val] of formData.entries()) {
    if (typeof val === 'string') data[key] = val
  }
  return data
}

export class ValPreviewPane extends ValElement {
  static observedAttributes = ['src', 'form-selector']

  private iframeEl: HTMLIFrameElement | null = null
  private toolbarEl: HTMLElement | null = null
  private form: HTMLFormElement | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private currentViewport = 'desktop'

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  connectedCallback (): void {
    super.connectedCallback()
    this.iframeEl = this.shadowRoot!.querySelector('iframe')
    this.toolbarEl = this.shadowRoot!.querySelector('.toolbar')
    this.toolbarEl?.addEventListener('click', this.handleToolbarClick)

    const src = this.getAttribute('src')
    if (src !== null && this.iframeEl !== null) {
      this.iframeEl.src = src
    }

    this.wireForm()
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.toolbarEl?.removeEventListener('click', this.handleToolbarClick)
    this.form?.removeEventListener('input', this.handleFormInput)
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (name === 'src' && this.iframeEl !== null && val !== null) {
      this.iframeEl.src = val
    }
    if (name === 'form-selector') {
      this.form?.removeEventListener('input', this.handleFormInput)
      this.wireForm()
    }
  }

  get viewport (): string {
    return this.currentViewport
  }

  setViewport (viewport: string): void {
    const width = VIEWPORT_WIDTHS[viewport]
    if (width === undefined || this.iframeEl === null) return
    this.currentViewport = viewport
    this.iframeEl.style.width = width

    const buttons = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('[data-viewport]')
    if (buttons !== undefined) {
      for (const btn of buttons) {
        btn.setAttribute('aria-pressed', btn.dataset['viewport'] === viewport ? 'true' : 'false')
      }
    }
    this.emitInteraction('viewport-change', { viewport })
  }

  refresh (): void {
    if (this.iframeEl === null) return
    const src = this.iframeEl.src
    this.iframeEl.src = ''
    this.iframeEl.src = src
    this.emitInteraction('refresh')
  }

  private wireForm (): void {
    const selector = this.getAttribute('form-selector')
    if (selector !== null) {
      this.form = document.querySelector<HTMLFormElement>(selector)
      this.form?.addEventListener('input', this.handleFormInput)
    }
  }

  private handleToolbarClick = (e: Event): void => {
    const target = e.target
    if (!(target instanceof HTMLButtonElement)) return

    const viewport = target.dataset['viewport']
    if (viewport !== undefined) {
      this.setViewport(viewport)
      return
    }

    if (target.classList.contains('refresh')) {
      this.refresh()
    }
  }

  private handleFormInput = (): void => {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      if (this.iframeEl === null || this.form === null) return
      const cw = this.iframeEl.contentWindow
      if (cw === null) return
      const data = serializeForm(this.form)
      cw.postMessage({ type: 'valence:preview-update', data }, window.location.origin)
      this.emitInteraction('preview-update')
    }, DEBOUNCE_MS)
  }
}
