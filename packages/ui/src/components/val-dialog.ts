import { ValElement } from '../core/val-element.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host { display: contents; }
  .wrapper {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
  }
  .panel {
    position: relative;
    z-index: 1;
    background: var(--val-color-bg-elevated);
    border-radius: var(--val-radius-lg);
    box-shadow: var(--val-shadow-lg);
    padding: var(--val-space-6);
    max-width: 32rem;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    font-family: var(--val-font-sans);
    color: var(--val-color-text);
  }
  .panel:focus { outline: none; }
</style>
<div class="wrapper" style="display: none;">
  <div class="backdrop"></div>
  <div class="panel" role="dialog" aria-modal="true" tabindex="-1">
    <slot></slot>
  </div>
</div>
`

export class ValDialog extends ValElement {
  static observedAttributes = ['open']

  private wrapperEl: HTMLElement | null = null
  private backdropEl: HTMLElement | null = null
  private panelEl: HTMLElement | null = null

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (this.wrapperEl === null) {
      this.wrapperEl = this.shadowRoot!.querySelector('.wrapper')!
      this.backdropEl = this.shadowRoot!.querySelector('.backdrop')!
      this.panelEl = this.shadowRoot!.querySelector('.panel')!
    }
    this.backdropEl!.addEventListener('click', this.handleBackdropClick)
    this.syncOpen()
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.backdropEl?.removeEventListener('click', this.handleBackdropClick)
    document.removeEventListener('keydown', this.handleEscape)
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (name === 'open' && this.wrapperEl !== null) {
      this.syncOpen()
    }
  }

  show (): void {
    if (!this.hasAttribute('open')) {
      this.setAttribute('open', '')
      this.emitInteraction('open')
    }
  }

  close (): void {
    if (this.hasAttribute('open')) {
      this.removeAttribute('open')
      this.emitInteraction('close')
    }
  }

  private syncOpen (): void {
    const isOpen = this.hasAttribute('open')
    this.wrapperEl!.style.display = isOpen ? 'flex' : 'none'

    if (isOpen) {
      document.addEventListener('keydown', this.handleEscape)
      this.panelEl?.focus()
    } else {
      document.removeEventListener('keydown', this.handleEscape)
    }
  }

  private handleEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close()
    }
  }

  private handleBackdropClick = (e: Event): void => {
    e.stopPropagation()
    this.close()
  }
}

customElements.define('val-dialog', ValDialog)
