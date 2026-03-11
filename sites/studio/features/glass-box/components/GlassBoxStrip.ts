import { GLASS_BOX_CONFIG } from '../config/glass-box-config.js'

interface BufferLike {
  readonly count: number
  readonly capacity: number
  readonly head: number
  slotAt (index: number): { isDirty: boolean } | undefined
}

interface WindowWithBuffer {
  __inertiaBuffer?: BufferLike & { write: (intent: Record<string, unknown>) => void }
}

export class GlassBoxStrip extends HTMLElement {
  private _buffer: BufferLike | null = null
  private _rafId: number = 0
  private _lastCount: number = -1
  private _flushMessageTimeout: ReturnType<typeof setTimeout> | null = null
  private _hardwareLabel: string = 'PI5'
  private _demoInterval: ReturnType<typeof setInterval> | null = null

  static get observedAttributes (): string[] {
    return ['hardware-label']
  }

  attributeChangedCallback (name: string, _old: string | null, value: string | null): void {
    const handlers: Record<string, () => void> = {
      'hardware-label': () => { this._hardwareLabel = value ?? 'PI5' }
    }
    handlers[name]?.()
  }

  get buffer (): BufferLike | null {
    return this._buffer
  }

  set buffer (buf: BufferLike) {
    this._buffer = buf
  }

  connectedCallback (): void {
    this.setAttribute('role', 'status')
    this.setAttribute('aria-label', 'Telemetry buffer status')
    this.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9998;
      height: ${GLASS_BOX_CONFIG.stripHeight}px;
      background: var(--card, #1a1a2e);
      border-top: 1px solid var(--border, #333);
      display: flex;
      align-items: center;
      padding: 0 12px;
      gap: 8px;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--muted-foreground, #888);
    `
    this._startRaf()
  }

  disconnectedCallback (): void {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId)
    }
    if (this._flushMessageTimeout) {
      clearTimeout(this._flushMessageTimeout)
    }
    if (this._demoInterval) {
      clearInterval(this._demoInterval)
    }
  }

  showFlushMessage (count: number): void {
    const msgEl = this.querySelector('.gb-flush-msg')
    if (msgEl) {
      msgEl.textContent = `flushed ${count} → PostgreSQL`
      ;(msgEl as HTMLElement).style.color = 'hsl(142, 60%, 50%)'
      ;(msgEl as HTMLElement).style.opacity = '1'

      if (this._flushMessageTimeout) {
        clearTimeout(this._flushMessageTimeout)
      }
      this._flushMessageTimeout = setTimeout(() => {
        ;(msgEl as HTMLElement).style.opacity = '0'
      }, GLASS_BOX_CONFIG.flushMessageDurationMs)
    }
  }

  private _onDemoFlood (): void {
    const win = window as unknown as WindowWithBuffer
    const buf = win.__inertiaBuffer
    if (!buf) return

    let written = 0
    const max = 50
    this._demoInterval = setInterval(() => {
      if (written >= max || buf.count >= Math.floor(buf.capacity * 0.8)) {
        if (this._demoInterval) {
          clearInterval(this._demoInterval)
          this._demoInterval = null
        }
        return
      }
      buf.write({
        type: 'CLICK',
        target: `demo-${written}`,
        timestamp: Date.now(),
        schema_version: 1
      })
      written++
    }, 50)
  }

  private _startRaf (): void {
    const tick = (): void => {
      this._rafId = requestAnimationFrame(tick)

      if (!this._buffer) return
      if (this._buffer.count === this._lastCount) return

      this._lastCount = this._buffer.count
      this._render()
    }
    this._rafId = requestAnimationFrame(tick)
  }

  private _render (): void {
    if (!this._buffer) return

    const { count, capacity, head } = this._buffer

    // On mobile: minimal view
    const isMobile = window.innerWidth < 768

    if (isMobile) {
      this.innerHTML = `
        <span class="gb-hw">${this._hardwareLabel}</span>
        <span class="gb-count">${count}/${capacity}</span>
        <span class="gb-flush-msg" style="opacity: 0; transition: opacity 0.3s; margin-left: auto;"></span>
      `
      return
    }

    // Desktop: full buffer visualization
    const slotCount = Math.min(capacity, 64) // Show max 64 slots visually
    const step = capacity / slotCount
    const slots: string[] = []

    for (let i = 0; i < slotCount; i++) {
      const idx = Math.floor(i * step)
      const slot = this._buffer.slotAt(idx)
      const filled = slot?.isDirty ?? false
      const color = filled ? 'var(--primary, #4a8fe7)' : 'var(--border, #333)'
      slots.push(`<span style="display:inline-block;width:6px;height:12px;background:${color};border-radius:1px;"></span>`)
    }

    this.innerHTML = `
      <span class="gb-hw">${this._hardwareLabel}</span>
      <span class="gb-head">▶${head}</span>
      <span class="gb-slots" style="display:flex;gap:1px;flex:1;">${slots.join('')}</span>
      <span class="gb-count">${count}/${capacity}</span>
      <button data-demo-flood style="background:transparent;border:1px solid var(--border,#333);color:var(--muted-foreground,#888);font-family:inherit;font-size:10px;padding:1px 6px;border-radius:2px;cursor:pointer;opacity:0;transition:opacity 0.2s;">DEMO</button>
      <span class="gb-flush-msg" style="opacity: 0; transition: opacity 0.3s;"></span>
    `

    const demoBtn = this.querySelector('[data-demo-flood]') as HTMLElement | null
    if (demoBtn) {
      this.addEventListener('mouseenter', () => { demoBtn.style.opacity = '1' })
      this.addEventListener('mouseleave', () => { demoBtn.style.opacity = '0' })
      demoBtn.addEventListener('click', () => this._onDemoFlood())
    }
  }
}

customElements.define('inertia-buffer-strip', GlassBoxStrip)
