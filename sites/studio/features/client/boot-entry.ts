// Client-side boot — loads telemetry, router, and Glass Box components
import { bootTelemetry } from '../telemetry/telemetry-boot.js'
import { initRouter } from '@inertia/core'
import { initNavActive } from './nav-active.js'
// Side-effect imports: each calls customElements.define()
import '../glass-box/components/GlassBoxStrip.js'
import '../glass-box/components/GlassBoxInspector.js'

function initHamburgerNav (): void {
  const btn = document.querySelector('.nav-hamburger') as HTMLElement | null
  const links = document.querySelector('.nav-links') as HTMLElement | null
  if (!btn || !links) return

  btn.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open')
    btn.setAttribute('aria-expanded', String(isOpen))
  })

  // Close menu on navigation
  document.addEventListener('inertia:before-swap', () => {
    links.classList.remove('open')
    btn.setAttribute('aria-expanded', 'false')
  })
}

function boot (): void {
  bootTelemetry()
  initNavActive()
  initHamburgerNav()

  const routerResult = initRouter({ contentSelector: '#main-content' })
  routerResult.match(
    () => {},
    (routerErr) => console.error('[router] Init failed:', routerErr.message)
  )

  // Wire Glass Box strip to telemetry buffer
  const buffer = (window as unknown as Record<string, unknown>).__inertiaBuffer
  const strip = document.querySelector('inertia-buffer-strip')
  if (buffer && strip) {
    (strip as unknown as { buffer: unknown }).buffer = buffer
  }
}

boot()
