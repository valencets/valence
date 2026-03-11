// Client-side boot — loads telemetry, router, and Glass Box components
import { bootTelemetry } from '../telemetry/telemetry-boot.js'
import { initRouter } from '@inertia/core'
// Side-effect imports: each calls customElements.define()
import '../glass-box/components/GlassBoxStrip.js'
import '../glass-box/components/GlassBoxInspector.js'

function boot (): void {
  bootTelemetry()

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
