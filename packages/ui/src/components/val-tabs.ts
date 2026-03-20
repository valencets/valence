import { ValElement } from '../core/val-element.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host { display: block; }
  .tablist {
    display: flex;
    border-bottom: 1px solid var(--val-color-border);
    gap: 0;
  }
  ::slotted([slot="tab"]) {
    padding: var(--val-space-2) var(--val-space-4);
    font-family: var(--val-font-sans);
    font-size: var(--val-text-sm);
    font-weight: var(--val-weight-medium);
    color: var(--val-color-text-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    user-select: none;
    outline: none;
  }
  ::slotted([slot="tab"]:hover) {
    color: var(--val-color-text);
  }
  ::slotted([slot="tab"][aria-selected="true"]) {
    color: var(--val-color-primary);
    border-bottom-color: var(--val-color-primary);
  }
  ::slotted([slot="tab"]:focus-visible) {
    box-shadow: var(--val-focus-ring);
    border-radius: var(--val-radius-sm);
  }
  .panels {
    padding: var(--val-space-4) 0;
  }
</style>
<div class="tablist" role="tablist">
  <slot name="tab"></slot>
</div>
<div class="panels">
  <slot name="panel"></slot>
</div>
`

type TabKeyHandler = (current: number, total: number) => number

const TAB_KEY_HANDLERS: Record<string, TabKeyHandler | undefined> = {
  ArrowRight: (current, total) => (current + 1) % total,
  ArrowLeft: (current, total) => (current - 1 + total) % total,
  Home: () => 0,
  End: (_current, total) => total - 1
}

export class ValTabs extends ValElement {
  private activeIndex = 0

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  connectedCallback (): void {
    super.connectedCallback()
    this.setupTabs()
    this.addEventListener('click', this.handleClick)
    this.addEventListener('keydown', this.handleKeydown)
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.removeEventListener('click', this.handleClick)
    this.removeEventListener('keydown', this.handleKeydown)
  }

  private getTabs (): HTMLElement[] {
    return Array.from(this.querySelectorAll('[slot="tab"]')) as HTMLElement[]
  }

  private getPanels (): HTMLElement[] {
    return Array.from(this.querySelectorAll('[slot="panel"]')) as HTMLElement[]
  }

  private setupTabs (): void {
    const tabs = this.getTabs()
    const panels = this.getPanels()
    const activeTab = tabs[this.activeIndex]
    const activePanelName = activeTab?.dataset.panel ?? ''

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]!
      const panelName = tab.dataset.panel ?? ''
      const tabId = `tab-${panelName}`
      const panelId = `panel-${panelName}`
      tab.id = tabId
      tab.setAttribute('role', 'tab')
      tab.setAttribute('tabindex', i === this.activeIndex ? '0' : '-1')
      tab.setAttribute('aria-selected', String(i === this.activeIndex))
      tab.setAttribute('aria-controls', panelId)
    }

    for (const panel of panels) {
      const panelName = panel.dataset.name ?? ''
      const panelId = `panel-${panelName}`
      const tabId = `tab-${panelName}`
      panel.id = panelId
      panel.setAttribute('role', 'tabpanel')
      panel.setAttribute('aria-labelledby', tabId)
      panel.hidden = panelName !== activePanelName
    }
  }

  private selectTab (index: number): void {
    const tabs = this.getTabs()
    if (index < 0 || index >= tabs.length) return

    this.activeIndex = index
    const panels = this.getPanels()

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]!
      const selected = i === index
      tab.setAttribute('aria-selected', String(selected))
      tab.setAttribute('tabindex', selected ? '0' : '-1')
    }

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i]!
      const panelName = panel.dataset.name
      const tabPanel = tabs[index]?.dataset.panel
      panel.hidden = panelName !== tabPanel
    }

    const selectedTab = tabs[index]!
    const panelName = selectedTab.dataset.panel ?? ''
    this.emitInteraction('change', { panel: panelName })
  }

  private handleClick = (e: Event): void => {
    const target = (e.target as HTMLElement).closest('[slot="tab"]') as HTMLElement | null
    if (target === null) return
    const tabs = this.getTabs()
    const index = tabs.indexOf(target)
    if (index >= 0) this.selectTab(index)
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    const target = (e.target as HTMLElement).closest('[slot="tab"]') as HTMLElement | null
    if (target === null) return

    const tabs = this.getTabs()
    const current = tabs.indexOf(target)
    if (current < 0) return

    const handler = TAB_KEY_HANDLERS[e.key]
    if (!handler) return

    e.preventDefault()
    this.selectTab(handler(current, tabs.length))
  }
}

customElements.define('val-tabs', ValTabs)
