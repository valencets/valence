import { GLASS_BOX_CONFIG, EXPLAINER_MAP } from '../config/glass-box-config.js'

export class GlassBoxInspector extends HTMLElement {
  private _hoverTimeout: ReturnType<typeof setTimeout> | null = null
  private _targetEl: Element | null = null

  static get observedAttributes (): string[] {
    return ['visible']
  }

  connectedCallback (): void {
    this.setAttribute('role', 'tooltip')
    this.setAttribute('aria-hidden', 'true')
    this.style.cssText = `
      position: fixed;
      z-index: 9999;
      width: ${GLASS_BOX_CONFIG.inspectorWidth}px;
      background: var(--card, #1a1a2e);
      border: 1px solid var(--border, #333);
      border-radius: var(--radius, 6px);
      padding: 12px;
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: var(--foreground, #e0e0e0);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      display: none;
    `

    document.addEventListener('mouseover', this._onMouseOver.bind(this))
    document.addEventListener('mouseout', this._onMouseOut.bind(this))
  }

  disconnectedCallback (): void {
    this._clearTimeout()
    document.removeEventListener('mouseover', this._onMouseOver.bind(this))
    document.removeEventListener('mouseout', this._onMouseOut.bind(this))
  }

  private _onMouseOver (e: Event): void {
    const target = (e.target as Element)?.closest?.('[data-telemetry-type]')
    if (!target) return

    this._targetEl = target
    this._clearTimeout()
    this._hoverTimeout = setTimeout(() => {
      this._show(target)
    }, GLASS_BOX_CONFIG.hoverDelayMs)
  }

  private _onMouseOut (e: Event): void {
    const related = (e as MouseEvent).relatedTarget as Element | null
    if (related?.closest?.('[data-telemetry-type]') === this._targetEl) return

    this._clearTimeout()
    this._hide()
  }

  private _show (target: Element): void {
    const type = target.getAttribute('data-telemetry-type') ?? 'unknown'
    const targetName = target.getAttribute('data-telemetry-target') ?? 'unknown'
    const explainer = EXPLAINER_MAP[type] ?? 'Telemetry event tracked.'

    // Get buffer info from global
    const buffer = (window as unknown as Record<string, unknown>).__inertiaBuffer as {
      count: number
      head: number
      capacity: number
    } | undefined
    const slot = buffer?.head ?? 0
    const isDirty = true

    this.innerHTML = `
      <div class="gb-row"><span class="gb-label">type</span> <span class="gb-value">${type}</span></div>
      <div class="gb-row"><span class="gb-label">target</span> <span class="gb-value">${targetName}</span></div>
      <div class="gb-row"><span class="gb-label">slot</span> <span class="gb-value">${slot}</span></div>
      <div class="gb-row"><span class="gb-label">dirty</span> <span class="gb-value">${isDirty}</span></div>
      <div class="gb-row"><span class="gb-label">buffer</span> <span class="gb-value">${buffer?.count ?? 0}/${buffer?.capacity ?? 1024}</span></div>
      <hr style="border-color: var(--border, #333); margin: 8px 0;">
      <p class="gb-explainer">${explainer}</p>
    `

    // Position near target
    const rect = target.getBoundingClientRect()
    const inspectorWidth = GLASS_BOX_CONFIG.inspectorWidth
    let left = rect.right + 8
    if (left + inspectorWidth > window.innerWidth) {
      left = rect.left - inspectorWidth - 8
    }
    let top = rect.top
    if (top < 0) top = 8

    this.style.left = `${left}px`
    this.style.top = `${top}px`
    this.style.display = 'block'
    this.style.opacity = '1'
    this.setAttribute('aria-hidden', 'false')
  }

  private _hide (): void {
    this.style.opacity = '0'
    this.style.display = 'none'
    this.setAttribute('aria-hidden', 'true')
    this._targetEl = null
  }

  private _clearTimeout (): void {
    if (this._hoverTimeout !== null) {
      clearTimeout(this._hoverTimeout)
      this._hoverTimeout = null
    }
  }
}

customElements.define('inertia-telemetry-infobox', GlassBoxInspector)
