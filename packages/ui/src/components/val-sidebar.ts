import { ValElement } from '../core/val-element.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host { display: block; }
  nav {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--val-color-bg-elevated);
    border-right: 1px solid var(--val-color-border);
    overflow: hidden;
    transition: width var(--val-duration-normal) var(--val-ease-in-out);
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: var(--val-space-2);
  }
  button {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--val-radius-md);
    cursor: pointer;
    color: var(--val-color-text-muted);
    font-size: var(--val-text-lg);
  }
  button:hover { background: var(--val-color-bg-muted); }
  button:focus-visible { box-shadow: var(--val-focus-ring); }
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--val-space-2) var(--val-space-2);
  }
  :host([collapsed]) .content { display: none; }
</style>
<nav role="navigation">
  <div class="header">
    <button type="button" aria-label="Toggle sidebar" aria-expanded="true">
      <span class="icon">\u25C0</span>
    </button>
  </div>
  <div class="content">
    <slot></slot>
  </div>
</nav>
`

export class ValSidebar extends ValElement {
  static observedAttributes = ['collapsed', 'width']

  private navEl: HTMLElement | null = null
  private toggleBtn: HTMLButtonElement | null = null

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (this.navEl === null) {
      this.navEl = this.shadowRoot!.querySelector('nav')!
      this.toggleBtn = this.shadowRoot!.querySelector('button')!
    }
    this.toggleBtn!.addEventListener('click', this.handleToggle)
    this.syncState()
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.toggleBtn?.removeEventListener('click', this.handleToggle)
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (this.navEl === null) return
    this.syncState()
  }

  private syncState (): void {
    const collapsed = this.hasAttribute('collapsed')
    this.toggleBtn!.setAttribute('aria-expanded', String(!collapsed))

    const width = this.getAttribute('width') ?? '16rem'
    this.navEl!.style.width = collapsed ? '3rem' : width
  }

  private handleToggle = (): void => {
    const willCollapse = !this.hasAttribute('collapsed')
    if (willCollapse) {
      this.setAttribute('collapsed', '')
    } else {
      this.removeAttribute('collapsed')
    }
    this.emitInteraction('toggle', { collapsed: willCollapse })
  }
}

customElements.define('val-sidebar', ValSidebar)
