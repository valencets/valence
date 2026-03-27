interface FragmentEvent {
  readonly selector: string
  readonly html: string
}

function parseFragment (html: string): DocumentFragment {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content
}

export function reconcileFragment (event: FragmentEvent): void {
  const targets = document.querySelectorAll(event.selector)
  for (const target of targets) {
    // Parse HTML into a DocumentFragment — this correctly handles
    // custom elements (val-*), triggering connectedCallback on insert
    // and disconnectedCallback on the replaced children
    const fragment = parseFragment(event.html)
    target.replaceChildren(...fragment.childNodes)
  }
}
