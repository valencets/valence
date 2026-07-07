interface FragmentEvent {
  readonly selector: string
  readonly html: string
}

function parseFragment (html: string): DocumentFragment {
  // DOMParser builds an inert document: nothing executes during parsing,
  // and the nodes only join the live document after sanitizeFragment has
  // stripped scripts, handlers, and javascript: URLs.
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const fragment = document.createDocumentFragment()
  for (const node of [...parsed.body.childNodes]) {
    fragment.appendChild(document.importNode(node, true))
  }
  return fragment
}

/**
 * Strip script tags and inline event handlers from a DocumentFragment.
 * Defense-in-depth against XSS in fragment render functions.
 * Developers should use escapeHtml() in their fragment functions,
 * but this catches cases where they forget.
 */
const EXECUTABLE_SCHEMES = ['javascript:', 'data:', 'vbscript:'] as const

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
    // Remove URLs whose scheme encodes executable content — javascript:
    // alone is an incomplete check; data: and vbscript: execute the same way.
    for (const urlAttr of ['href', 'src']) {
      if (!el.hasAttribute(urlAttr)) continue
      const value = (el.getAttribute(urlAttr) ?? '').trimStart().toLowerCase()
      if (EXECUTABLE_SCHEMES.some(scheme => value.startsWith(scheme))) {
        el.removeAttribute(urlAttr)
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
