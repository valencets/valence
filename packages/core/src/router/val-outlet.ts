// val-outlet Web Component
// Marks where child content swaps during fragment navigation.
// Parent templates (nav, sidebar, footer) persist while only outlet content swaps.

export class ValOutlet extends HTMLElement {
  get outletName (): string | null {
    return this.getAttribute('name')
  }
}

customElements.define('val-outlet', ValOutlet)

export function findOutlet (container: Element, name?: string): ValOutlet | null {
  if (name === undefined) {
    // Find default (unnamed) outlet -- one without a name attribute
    for (const el of container.querySelectorAll('val-outlet')) {
      if (!el.hasAttribute('name')) {
        return el as ValOutlet
      }
    }
    return null
  }

  const el = container.querySelector(`val-outlet[name="${CSS.escape(name)}"]`)
  if (el === null) return null
  return el as ValOutlet
}
