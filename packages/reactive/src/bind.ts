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

export function bind (el: Element, bindings: BindingMap): () => void {
  const disposers: Array<() => void> = []

  if (bindings.text !== undefined) {
    const sig = bindings.text
    disposers.push(effect(() => {
      el.textContent = sig.value
    }))
  }

  if (bindings.value !== undefined) {
    const sig = bindings.value
    const inp = el as HTMLInputElement
    disposers.push(effect(() => {
      inp.value = sig.value
    }))
    const onInput = (): void => { sig.value = inp.value }
    inp.addEventListener('input', onInput)
    disposers.push(() => { inp.removeEventListener('input', onInput) })
  }

  if (bindings.checked !== undefined) {
    const sig = bindings.checked
    const inp = el as HTMLInputElement
    disposers.push(effect(() => {
      inp.checked = sig.value
    }))
    const onChange = (): void => { sig.value = inp.checked }
    inp.addEventListener('change', onChange)
    disposers.push(() => { inp.removeEventListener('change', onChange) })
  }

  if (bindings.visible !== undefined) {
    const sig = bindings.visible
    const htmlEl = el as HTMLElement
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

  if (bindings.disabled !== undefined) {
    const sig = bindings.disabled
    const inp = el as HTMLInputElement
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
