import { ValElement } from '../core/val-element.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host { display: inline-block; }
  :host([disabled]) { pointer-events: none; opacity: 0.5; }
  :host([loading]) { pointer-events: none; }
  button {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--val-space-2);
    padding: var(--val-space-2) var(--val-space-4);
    border-radius: var(--val-radius-md);
    font-family: var(--val-font-sans);
    font-size: var(--val-text-sm);
    font-weight: var(--val-weight-medium);
    line-height: var(--val-leading-normal);
    cursor: pointer;
    transition: background var(--val-duration-fast) var(--val-ease-in-out),
                color var(--val-duration-fast) var(--val-ease-in-out);
    background: var(--val-color-primary);
    color: var(--val-color-primary-text);
  }
  button:hover { background: var(--val-color-primary-hover); }
  button:focus-visible { box-shadow: var(--val-focus-ring); }

  :host([variant="secondary"]) button {
    background: transparent;
    color: var(--val-color-text);
    box-shadow: inset 0 0 0 1px var(--val-color-border);
  }
  :host([variant="secondary"]) button:hover {
    background: var(--val-color-bg-muted);
  }
  :host([variant="secondary"]) button:focus-visible {
    box-shadow: inset 0 0 0 1px var(--val-color-border), var(--val-focus-ring);
  }
  :host([variant="ghost"]) button {
    background: transparent;
    color: var(--val-color-text);
  }
  :host([variant="ghost"]) button:hover {
    background: var(--val-color-bg-muted);
  }

  :host([size="sm"]) button {
    padding: var(--val-space-1) var(--val-space-3);
    font-size: var(--val-text-xs);
  }
  :host([size="lg"]) button {
    padding: var(--val-space-3) var(--val-space-6);
    font-size: var(--val-text-base);
  }
</style>
<button type="button" part="button"><slot></slot></button>
`

export class ValButton extends ValElement {
  static observedAttributes = ['disabled', 'loading', 'type']

  private buttonEl: HTMLButtonElement | null = null

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (this.buttonEl === null) {
      this.buttonEl = this.shadowRoot!.querySelector('button')
    }
    this.buttonEl!.addEventListener('click', this.handleClick)
    this.syncDisabled()
    this.syncLoading()
    this.syncType()
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.buttonEl?.removeEventListener('click', this.handleClick)
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (this.buttonEl === null) return
    if (name === 'disabled') this.syncDisabled()
    if (name === 'loading') this.syncLoading()
    if (name === 'type') this.syncType()
  }

  private syncDisabled (): void {
    const disabled = this.hasAttribute('disabled')
    this.buttonEl!.disabled = disabled
    this.buttonEl!.setAttribute('aria-disabled', String(disabled))
  }

  private syncLoading (): void {
    const loading = this.hasAttribute('loading')
    this.buttonEl!.setAttribute('aria-busy', String(loading))
  }

  private syncType (): void {
    const type = (this.getAttribute('type') ?? 'button') as 'button' | 'submit' | 'reset'
    this.buttonEl!.type = type
  }

  private handleClick = (): void => {
    if (this.hasAttribute('disabled') || this.hasAttribute('loading')) return
    const type = this.getAttribute('type')
    if (type === 'submit') {
      this.closest('form')?.requestSubmit()
    } else if (type === 'reset') {
      this.closest('form')?.reset()
    }
    this.emitInteraction('click')
  }
}

customElements.define('val-button', ValButton)
