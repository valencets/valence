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

// Track open dialogs for stacked Escape handling
const openDialogs: ValDialog[] = []

export class ValDialog extends ValElement {
  static observedAttributes = ['open']

  private wrapperEl: HTMLElement | null = null
  private backdropEl: HTMLElement | null = null
  private panelEl: HTMLElement | null = null
  private previouslyFocused: HTMLElement | null = null

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
    document.removeEventListener('keydown', this.handleKeydown)
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (name === 'open' && this.wrapperEl !== null) {
      this.syncOpen()
    }
  }

  show (): void {
    if (!this.hasAttribute('open')) {
      this.previouslyFocused = document.activeElement as HTMLElement | null
      this.setAttribute('open', '')
      this.emitInteraction('open')
    }
  }

  close (): void {
    if (this.hasAttribute('open')) {
      this.removeAttribute('open')
      this.emitInteraction('close')
      // Restore focus to the element that opened the dialog
      this.previouslyFocused?.focus()
      this.previouslyFocused = null
    }
  }

  private syncOpen (): void {
    const isOpen = this.hasAttribute('open')
    this.wrapperEl!.style.display = isOpen ? 'flex' : 'none'

    if (isOpen) {
      openDialogs.push(this)
      document.addEventListener('keydown', this.handleKeydown)
      this.panelEl?.focus()
    } else {
      const idx = openDialogs.indexOf(this)
      if (idx >= 0) openDialogs.splice(idx, 1)
      document.removeEventListener('keydown', this.handleKeydown)
    }
  }

  private getFocusableElements (): HTMLElement[] {
    if (this.panelEl === null) return []
    const slot = this.panelEl.querySelector('slot')
    if (slot === null) return []
    const assigned = slot.assignedElements({ flatten: true })
    const focusable: HTMLElement[] = []
    for (const el of assigned) {
      // Check the element itself and its descendants
      const candidates = [el, ...el.querySelectorAll('*')]
      for (const candidate of candidates) {
        if (candidate instanceof HTMLElement && this.isFocusable(candidate)) {
          focusable.push(candidate)
        }
      }
    }
    return focusable
  }

  private isFocusable (el: HTMLElement): boolean {
    if (el.hasAttribute('disabled')) return false
    if (el.getAttribute('tabindex') === '-1') return false
    const tag = el.tagName
    if (tag === 'A' && el.hasAttribute('href')) return true
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true
    if (el.getAttribute('tabindex') !== null) return true
    return false
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    // Only the topmost dialog handles keyboard
    if (openDialogs[openDialogs.length - 1] !== this) return

    if (e.key === 'Escape') {
      e.preventDefault()
      this.close()
      return
    }

    // Focus trap
    if (e.key === 'Tab') {
      const focusable = this.getFocusableElements()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === this.panelEl) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }

  private handleBackdropClick = (e: Event): void => {
    e.stopPropagation()
    this.close()
  }
}
