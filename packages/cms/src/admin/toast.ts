import { escapeHtml } from './escape.js'
import type { FlashMessage } from './flash.js'

function renderToast (msg: FlashMessage): string {
  const cls = `toast toast-${msg.type}`
  return `<div class="${cls}" role="alert" aria-live="polite">
  <span class="toast-message">${escapeHtml(msg.text)}</span>
  <button class="toast-dismiss" aria-label="Dismiss">&times;</button>
</div>`
}

export { renderToast }
