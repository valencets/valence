import { ResultAsync } from '@valencets/resultkit'
import { themeManager, ThemeMode, createTokenSheet } from '@valencets/ui'
import overrideCss from '../styles/km-overrides.css'
import { initBlocksFields } from './blocks-client.js'

// Kinetic Monolith: set dark theme + overrides BEFORE registering components
// so elements adopt the correct sheet on first connect
themeManager.setTheme(ThemeMode.Dark)
themeManager.applyOverrides(createTokenSheet(overrideCss))

// Lazy-load component registration — FOUC CSS hides :not(:defined) until upgrade
ResultAsync.fromPromise(import('@valencets/ui'), () => undefined).map(({ registerAll }) => registerAll())

// Lazy-load Tiptap only when richtext editors exist on the page
async function loadAndInitEditors (): Promise<void> {
  const { initAllEditors } = await import('./tiptap-entry.js')
  initAllEditors()
}

// Script is type="module" so DOM is ready — no need for DOMContentLoaded
if (document.querySelector('.richtext-editor')) {
  ResultAsync.fromPromise(loadAndInitEditors(), () => undefined)
}
initBlocksFields()

// Login form reactive bindings — lazy-load to keep first-flight bundle small
const loginForm = document.querySelector<HTMLFormElement>('form[action="/admin/login"]')
if (loginForm) {
  ResultAsync.fromPromise(import('./login-reactive.js'), () => undefined).map(({ initLoginForm }) => initLoginForm(loginForm))
}

// Wire up conditional field partial re-render (htmx-compatible data attributes)
const conditionalForm = document.querySelector<HTMLFormElement>('form[hx-post][hx-trigger][hx-target]')
if (conditionalForm) {
  const postUrl = conditionalForm.getAttribute('hx-post')
  const targetSelector = conditionalForm.getAttribute('hx-target')
  if (postUrl && targetSelector) {
    const target = document.querySelector(targetSelector)
    const handleConditionalChange = (): Promise<void> => {
      const formData = new FormData(conditionalForm)
      const params = new URLSearchParams()
      for (const [key, val] of formData.entries()) {
        if (typeof val === 'string') params.append(key, val)
      }
      const run = async (): Promise<void> => {
        const res = await fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        })
        if (res.ok && target) {
          const html = await res.text()
          target.innerHTML = html // Server-rendered, escaped via escapeHtml()
          if (target.querySelector('.richtext-editor')) {
            await loadAndInitEditors()
          }
        }
      }
      // Fetch failures are ignored — never rejects, so callers can fire-and-forget
      return ResultAsync.fromPromise(run(), () => undefined).match(() => undefined, () => undefined)
    }
    conditionalForm.addEventListener('change', (e) => {
      const el = e.target as Element | null
      if (el?.closest('.condition-trigger')) {
        handleConditionalChange()
      }
    })
  }
}

// Wire up media upload fields
const mediaUploads = document.querySelectorAll<HTMLElement>('.media-drop-zone')
for (const wrap of mediaUploads) {
  const endpoint = wrap.getAttribute('data-upload-endpoint')
  const fileInput = wrap.querySelector<HTMLInputElement>('input[type="file"]')
  const hiddenInput = wrap.querySelector<HTMLInputElement>('input[type="hidden"]')
  const preview = wrap.querySelector<HTMLElement>('.media-preview')
  if (!endpoint || !fileInput || !hiddenInput) continue
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    const upload = async (): Promise<void> => {
      const res = await fetch(endpoint, { method: 'POST', body: formData })
      const json = await res.json() as { filename?: string; id?: string }
      const value = json.id ?? json.filename ?? ''
      hiddenInput.value = value
      if (preview) {
        if (file.type.startsWith('image/')) {
          const img = document.createElement('img')
          img.src = `/media/${encodeURIComponent(value)}`
          img.alt = ''
          preview.replaceChildren(img)
        } else {
          const span = document.createElement('span')
          span.textContent = file.name
          preview.replaceChildren(span)
        }
      }
    }
    ResultAsync.fromPromise(upload(), () => undefined).match(
      () => undefined,
      () => {
        if (preview) {
          const span = document.createElement('span')
          span.style.color = 'var(--val-color-error)'
          span.textContent = 'Upload failed'
          preview.replaceChildren(span)
        }
      }
    )
  })
}
