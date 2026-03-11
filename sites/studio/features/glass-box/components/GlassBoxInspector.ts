import { GLASS_BOX_CONFIG, EXPLAINER_MAP } from '../config/glass-box-config.js'

const IGNORED_TAGS: Record<string, boolean> = {
  INPUT: true,
  TEXTAREA: true,
  SELECT: true
}

export class GlassBoxInspector extends HTMLElement {
  private _hoverTimeout: ReturnType<typeof setTimeout> | null = null
  private _targetEl: Element | null = null
  private _overlayActive = false
  private _overlayLabels: HTMLElement[] = []
  private _boundMouseOver: ((e: Event) => void) | null = null
  private _boundMouseOut: ((e: Event) => void) | null = null
  private _boundKeyDown: ((e: Event) => void) | null = null

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

    this._boundMouseOver = this._onMouseOver.bind(this)
    this._boundMouseOut = this._onMouseOut.bind(this)
    this._boundKeyDown = this._onKeyDown.bind(this)
    document.addEventListener('mouseover', this._boundMouseOver)
    document.addEventListener('mouseout', this._boundMouseOut)
    document.addEventListener('keydown', this._boundKeyDown)
  }

  disconnectedCallback (): void {
    this._clearTimeout()
    this._removeOverlayLabels()
    if (this._boundMouseOver) document.removeEventListener('mouseover', this._boundMouseOver)
    if (this._boundMouseOut) document.removeEventListener('mouseout', this._boundMouseOut)
    if (this._boundKeyDown) document.removeEventListener('keydown', this._boundKeyDown)
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

  private _onKeyDown (e: Event): void {
    const ke = e as KeyboardEvent
    if (ke.key !== '`') return

    const tag = document.activeElement?.tagName ?? ''
    if (IGNORED_TAGS[tag] === true) return

    this._overlayActive = !this._overlayActive

    if (this._overlayActive) {
      this._showOverlayLabels()
    } else {
      this._removeOverlayLabels()
    }
  }

  private _showOverlayLabels (): void {
    const targets = document.querySelectorAll('[data-telemetry-type]')
    for (const target of targets) {
      const type = target.getAttribute('data-telemetry-type') ?? ''
      const tgt = target.getAttribute('data-telemetry-target') ?? ''

      const label = document.createElement('span')
      label.setAttribute('data-overlay-label', '')
      label.textContent = tgt ? `${type} / ${tgt}` : type
      label.style.cssText = 'position:absolute;z-index:10000;font-family:var(--font-mono,monospace);font-size:10px;background:hsl(215,60%,55%/0.9);color:white;padding:2px 4px;border-radius:2px;pointer-events:none;white-space:nowrap;'

      const rect = target.getBoundingClientRect()
      label.style.left = `${rect.left + window.scrollX}px`
      label.style.top = `${rect.top + window.scrollY}px`

      document.body.appendChild(label)
      this._overlayLabels.push(label)
    }
  }

  private _removeOverlayLabels (): void {
    for (const label of this._overlayLabels) {
      label.remove()
    }
    this._overlayLabels = []
  }

  private _clearTimeout (): void {
    if (this._hoverTimeout !== null) {
      clearTimeout(this._hoverTimeout)
      this._hoverTimeout = null
    }
  }
}

customElements.define('inertia-telemetry-infobox', GlassBoxInspector)
