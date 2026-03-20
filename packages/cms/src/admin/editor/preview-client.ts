const PREVIEW_DEBOUNCE_MS = 300

const VIEWPORT_WIDTHS: Record<string, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px'
}

function serializeForm (form: HTMLFormElement): Record<string, string> {
  const data: Record<string, string> = {}
  const formData = new FormData(form)
  for (const [key, val] of formData.entries()) {
    if (typeof val === 'string') data[key] = val
  }
  return data
}

function wireViewportSwitcher (iframe: HTMLIFrameElement): void {
  const viewportBtns = document.querySelectorAll<HTMLButtonElement>('[data-viewport]')
  for (const btn of viewportBtns) {
    btn.addEventListener('click', () => {
      const vp = btn.getAttribute('data-viewport') ?? ''
      const width = VIEWPORT_WIDTHS[vp]
      if (width !== undefined) {
        iframe.style.width = width
      }
    })
  }
}

function wireRefreshButton (iframe: HTMLIFrameElement): void {
  const refreshBtn = document.querySelector<HTMLButtonElement>('.preview-refresh')
  if (refreshBtn === null) return
  refreshBtn.addEventListener('click', () => {
    const src = iframe.src
    iframe.src = ''
    iframe.src = src
  })
}

function wireFormInput (iframe: HTMLIFrameElement, form: HTMLFormElement): void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  form.addEventListener('input', () => {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const cw = iframe.contentWindow
      if (cw === null) return
      const data = serializeForm(form)
      cw.postMessage({ type: 'valence:preview-update', data }, '*')
    }, PREVIEW_DEBOUNCE_MS)
  })
}

export function initLivePreview (): void {
  const iframe = document.querySelector<HTMLIFrameElement>('.preview-iframe')
  const form = document.querySelector<HTMLFormElement>('.admin-form')
  if (iframe === null || form === null) return
  wireFormInput(iframe, form)
  wireViewportSwitcher(iframe)
  wireRefreshButton(iframe)
}
