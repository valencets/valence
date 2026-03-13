import { HUD_COLORS, HUD_CHART } from '../tokens/hud-tokens.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

export class HudSparkline extends HTMLElement {
  static observedAttributes = ['data', 'width', 'height']

  private _initialized = false
  private svg: SVGSVGElement | null = null
  private polyline: SVGPolylineElement | null = null

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.style.display = 'block'
    this.style.width = '100%'

    const w = this.getWidth()
    const h = this.getHeight()

    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.setAttribute('viewBox', `0 0 ${String(w)} ${String(h)}`)
    this.svg.setAttribute('width', '100%')
    this.svg.setAttribute('height', String(h))
    this.svg.setAttribute('preserveAspectRatio', 'none')
    this.svg.style.display = 'block'

    this.polyline = document.createElementNS(SVG_NS, 'polyline')
    this.polyline.setAttribute('fill', 'none')
    this.polyline.setAttribute('stroke', HUD_COLORS.accent)
    this.polyline.setAttribute('stroke-width', String(HUD_CHART.sparkline.strokeWidth))
    this.polyline.setAttribute('stroke-linejoin', 'round')

    this.svg.appendChild(this.polyline)
    this.appendChild(this.svg)

    this.renderPoints()
  }

  disconnectedCallback (): void {
    // Intentional no-op — cleanup reserved for future use
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  attributeChangedCallback (name: string, _old: string | null, _value: string | null): void {
    const handlers: Record<string, () => void> = {
      data: () => this.renderPoints(),
      width: () => this.updateViewBox(),
      height: () => this.updateViewBox()
    }
    handlers[name]?.()
  }

  private renderPoints (): void {
    if (this.polyline === null || this.svg === null) return

    const raw = this.getAttribute('data') ?? ''
    const values = raw.split(',').map(Number).filter(n => !Number.isNaN(n))

    if (values.length === 0) {
      const midY = this.getHeight() / 2
      this.polyline.setAttribute('points', `0,${String(midY)} ${String(this.getWidth())},${String(midY)}`)
      return
    }

    if (values.length === 1) {
      const midY = this.getHeight() / 2
      const midX = this.getWidth() / 2
      this.polyline.setAttribute('points', `${String(midX)},${String(midY)}`)
      return
    }

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const w = this.getWidth()
    const h = this.getHeight()
    const padding = 2

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - padding - ((v - min) / range) * (h - padding * 2)
      return `${String(x)},${String(y)}`
    }).join(' ')

    this.polyline.setAttribute('points', points)
  }

  private updateViewBox (): void {
    if (this.svg === null) return
    const w = this.getWidth()
    const h = this.getHeight()
    this.svg.setAttribute('viewBox', `0 0 ${String(w)} ${String(h)}`)
    this.svg.setAttribute('height', String(h))
    this.renderPoints()
  }

  private getWidth (): number {
    return Number(this.getAttribute('width')) || HUD_CHART.sparkline.width
  }

  private getHeight (): number {
    return Number(this.getAttribute('height')) || HUD_CHART.sparkline.height
  }
}

customElements.define('hud-sparkline', HudSparkline)
