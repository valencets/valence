// @valencets/reactive — DOM hydration bindings.
// Attaches signals to server-rendered markup. Not a template engine.
// DOM-agnostic: works with light DOM or shadow DOM elements.

import type { Signal, ReadonlySignal } from './core.js'
import { effect } from './core.js'

export interface BindingMap {
  readonly text?: ReadonlySignal<string>
  readonly value?: Signal<string>
  readonly checked?: Signal<boolean>
  readonly visible?: ReadonlySignal<boolean>
  readonly class?: Readonly<Record<string, ReadonlySignal<boolean>>>
  readonly attr?: Readonly<Record<string, ReadonlySignal<string | null>>>
  readonly disabled?: ReadonlySignal<boolean>
}

// H1: denylist event handler attributes to prevent XSS via setAttribute
const DENIED_ATTR_PREFIX = 'on'

function isInputLike (el: Element): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
}

// Form-associated custom elements (val-input, val-select, …) expose the
// native contract as properties — duck-type them so the binding layer
// binds the framework's own components, not just built-ins.
function hasValueProperty (el: Element): el is Element & { value: string } {
  return 'value' in el && typeof (el as Element & { value: unknown }).value === 'string'
}

function hasCheckedProperty (el: Element): el is Element & { checked: boolean } {
  return 'checked' in el && typeof (el as Element & { checked: unknown }).checked === 'boolean'
}

export function bind (el: Element, bindings: BindingMap): () => void {
  const disposers: Array<() => void> = []

  if (bindings.text !== undefined) {
    const sig = bindings.text
    disposers.push(effect(() => {
      el.textContent = sig.value
    }))
  }

  if (bindings.value !== undefined && (isInputLike(el) || hasValueProperty(el))) {
    const sig = bindings.value
    const inp = el as Element & { value: string }
    disposers.push(effect(() => {
      inp.value = sig.value
    }))
    // input for keystroke-carrying controls, change for commit-only ones
    // (custom selects) — reading .value twice is harmless.
    const onEdit = (): void => { sig.value = inp.value }
    inp.addEventListener('input', onEdit)
    inp.addEventListener('change', onEdit)
    disposers.push(() => {
      inp.removeEventListener('input', onEdit)
      inp.removeEventListener('change', onEdit)
    })
  }

  if (bindings.checked !== undefined && (el instanceof HTMLInputElement || hasCheckedProperty(el))) {
    const sig = bindings.checked
    const inp = el as Element & { checked: boolean }
    disposers.push(effect(() => {
      inp.checked = sig.value
    }))
    const onChange = (): void => { sig.value = inp.checked }
    inp.addEventListener('change', onChange)
    disposers.push(() => { inp.removeEventListener('change', onChange) })
  }

  if (bindings.visible !== undefined && el instanceof HTMLElement) {
    const sig = bindings.visible
    const htmlEl = el
    disposers.push(effect(() => {
      htmlEl.style.display = sig.value ? '' : 'none'
    }))
  }

  if (bindings.class !== undefined) {
    for (const [className, sig] of Object.entries(bindings.class)) {
      disposers.push(effect(() => {
        if (sig.value) {
          el.classList.add(className)
        } else {
          el.classList.remove(className)
        }
      }))
    }
  }

  if (bindings.attr !== undefined) {
    for (const [attrName, sig] of Object.entries(bindings.attr)) {
      // H1: block event handler attributes to prevent XSS
      if (attrName.toLowerCase().startsWith(DENIED_ATTR_PREFIX)) continue
      disposers.push(effect(() => {
        const val = sig.value
        if (val === null) {
          el.removeAttribute(attrName)
        } else {
          el.setAttribute(attrName, val)
        }
      }))
    }
  }

  if (bindings.disabled !== undefined && isInputLike(el)) {
    const sig = bindings.disabled
    const inp = el
    disposers.push(effect(() => {
      inp.disabled = sig.value
    }))
  }

  return () => {
    for (const dispose of disposers) {
      dispose()
    }
  }
}
