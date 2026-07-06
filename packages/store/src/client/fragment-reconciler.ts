interface FragmentEvent {
  readonly selector: string
  readonly html: string
}

function parseFragment (html: string): DocumentFragment {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content
}

/**
 * Strip script tags and inline event handlers from a DocumentFragment.
 * Defense-in-depth against XSS in fragment render functions.
 * Developers should use escapeHtml() in their fragment functions,
 * but this catches cases where they forget.
 */
function sanitizeFragment (fragment: DocumentFragment): void {
  const scripts = fragment.querySelectorAll('script')
  for (const script of scripts) {
    script.remove()
  }
  const allElements = fragment.querySelectorAll('*')
  for (const el of allElements) {
    const attrs = el.getAttributeNames()
    for (const attr of attrs) {
      if (attr.startsWith('on')) {
        el.removeAttribute(attr)
      }
    }
    // Remove javascript: hrefs
    if (el.hasAttribute('href')) {
      const href = el.getAttribute('href') ?? ''
      if (href.trimStart().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute('href')
      }
    }
    if (el.hasAttribute('src')) {
      const src = el.getAttribute('src') ?? ''
      if (src.trimStart().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute('src')
      }
    }
  }
}

export function reconcileFragment (event: FragmentEvent): void {
  const targets = document.querySelectorAll(event.selector)
  for (const target of targets) {
    const fragment = parseFragment(event.html)
    sanitizeFragment(fragment)
    target.replaceChildren(...fragment.childNodes)
  }
}
