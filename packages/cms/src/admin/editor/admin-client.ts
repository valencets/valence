import { registerAll, themeManager, ThemeMode, createTokenSheet } from '@valencets/ui'
import { initBlocksFields } from './blocks-client.js'

// Kinetic Monolith: set dark theme + overrides BEFORE registering components
// so elements adopt the correct sheet on first connect
themeManager.setTheme(ThemeMode.Dark)
themeManager.applyOverrides(createTokenSheet(`:host, :root {
  --val-color-primary: linear-gradient(135deg, oklch(0.90 0.19 159.5), oklch(0.80 0.19 159.5));
  --val-color-primary-hover: linear-gradient(135deg, oklch(0.92 0.17 159.5), oklch(0.83 0.19 159.5));
  --val-color-primary-text: #00391d;
  --val-color-bg: #131313;
  --val-color-bg-elevated: #353534;
  --val-color-bg-muted: #201f1f;
  --val-color-text: #e5e2e1;
  --val-color-text-muted: #bacbbc;
  --val-color-border: transparent;
  --val-color-border-focus: oklch(0.90 0.19 159.5);
  --val-focus-ring: inset 0 0 0 1px oklch(0.90 0.19 159.5 / 0.1);
}`))
registerAll()

// Lazy-load Tiptap only when richtext editors exist on the page
async function loadAndInitEditors (): Promise<void> {
  const { initAllEditors } = await import('./tiptap-entry.js')
  initAllEditors()
}

// Script is type="module" so DOM is ready — no need for DOMContentLoaded
if (document.querySelector('.richtext-editor')) {
  loadAndInitEditors().catch(() => { /* dynamic import failed */ })
}
initBlocksFields()

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
      return fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      }).then((res) => {
        if (res.ok && target) {
          return res.text().then((html) => {
            target.innerHTML = html // Server-rendered, escaped via escapeHtml()
            if (target.querySelector('.richtext-editor')) {
              return loadAndInitEditors()
            }
            return Promise.resolve()
          })
        }
        return Promise.resolve()
      }).catch(() => { /* ignore fetch errors */ })
    }
    conditionalForm.addEventListener('change', (e) => {
      const el = e.target as Element | null
      if (el?.closest('.condition-trigger')) {
        handleConditionalChange().catch(() => { /* ignore */ })
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
    fetch(endpoint, { method: 'POST', body: formData })
      .then((res) => res.json() as Promise<{ filename?: string; id?: string }>)
      .then((json) => {
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
      })
      .catch(() => {
        if (preview) {
          const span = document.createElement('span')
          span.style.color = 'var(--val-color-error)'
          span.textContent = 'Upload failed'
          preview.replaceChildren(span)
        }
      })
  })
}
