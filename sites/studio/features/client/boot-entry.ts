// Client-side boot — loads telemetry, router, and Glass Box components
import { bootTelemetry } from '../telemetry/telemetry-boot.js'
import { initRouter } from '@inertia/core'
import { initNavActive } from './nav-active.js'
// Side-effect imports: each calls customElements.define()
import '../glass-box/components/GlassBoxStrip.js'
import '../glass-box/components/GlassBoxInspector.js'
import './components/CacheIndicator.js'
import './components/SpeedShowcase.js'

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

function initAuditForm (): void {
  document.body.addEventListener('submit', (e: Event) => {
    const form = (e.target as Element).closest('.audit-form') as HTMLFormElement | null
    if (form === null) return
    e.preventDefault()

    const btn = form.querySelector('.audit-submit') as HTMLButtonElement | null
    if (btn === null) return
    btn.disabled = true
    const label = btn.querySelector('.audit-btn-label') as HTMLElement | null
    const loading = btn.querySelector('.audit-btn-loading') as HTMLElement | null
    if (label) label.hidden = true
    if (loading) loading.hidden = false

    const idle = form.querySelector('.audit-status-idle') as HTMLElement | null
    const progress = form.querySelector('.audit-status-loading') as HTMLElement | null
    if (idle) idle.hidden = true
    if (progress) progress.hidden = false

    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Inertia-Fragment': '1' },
      body: new URLSearchParams(new FormData(form) as unknown as Record<string, string>)
    }).then(
      (res) => res.text().then((html) => {
        const title = res.headers.get('X-Inertia-Title')
        const main = document.querySelector('#main-content')
        if (main === null) return
        document.dispatchEvent(new CustomEvent('inertia:before-swap'))
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const fragment = doc.querySelector('#main-content') ?? doc.body
        main.replaceChildren(...fragment.childNodes)
        document.dispatchEvent(new CustomEvent('inertia:after-swap'))
        if (title !== null) document.title = title
        window.scrollTo(0, 0)
      }),
      () => {
        btn.disabled = false
        if (label) label.hidden = false
        if (loading) loading.hidden = true
        if (idle) idle.hidden = false
        if (progress) progress.hidden = true
      }
    )
  })
}

function boot (): void {
  bootTelemetry()
  initNavActive()
  initHamburgerNav()
  initAuditForm()

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
