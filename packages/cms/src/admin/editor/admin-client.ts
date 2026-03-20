import { initBlocksFields } from './blocks-client.js'
import { initAllEditors } from './lexical-entry.js'
import { initBulkActions } from './bulk-client.js'
import { initLivePreview } from './preview-client.js'
import { initAutosave } from './autosave-client.js'

// Script is defer'd so DOM is ready — no need for DOMContentLoaded
initAllEditors()
initBlocksFields()
initBulkActions()
initLivePreview()

// Wire up autosave for versioned collections
const autosaveIndicator = document.querySelector<HTMLElement>('.autosave-indicator')
const adminForm = document.querySelector<HTMLFormElement>('.admin-form')
if (autosaveIndicator && adminForm) {
  initAutosave(adminForm, autosaveIndicator)
}

// Wire up delete dialog triggers
const trigger = document.querySelector<HTMLElement>('.delete-trigger')
const dialog = document.getElementById('delete-dialog') as HTMLElement & { show?: () => void; close?: () => void } | null
const cancel = document.getElementById('delete-cancel')
const confirmBtn = document.getElementById('delete-confirm')
const form = document.getElementById('delete-form') as HTMLFormElement | null

if (trigger && dialog) {
  trigger.addEventListener('click', () => {
    if (typeof dialog.show === 'function') dialog.show()
  })
}
if (cancel && dialog) {
  cancel.addEventListener('click', () => {
    if (typeof dialog.close === 'function') dialog.close()
  })
}
if (confirmBtn && form) {
  confirmBtn.addEventListener('click', () => {
    form.submit()
  })
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
      return fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      }).then((res) => {
        if (res.ok && target) {
          return res.text().then((html) => { target.innerHTML = html; initAllEditors() })
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
            preview.innerHTML = `<img src="/media/${value}" alt="">`
          } else {
            preview.innerHTML = `<span>${file.name}</span>`
          }
        }
      })
      .catch(() => {
        if (preview) preview.innerHTML = '<span style="color: var(--val-color-error);">Upload failed</span>'
      })
  })
}
