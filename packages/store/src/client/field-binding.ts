// Declarative field binding: the ugliness-killer for store pages.
//
// One `data-store="slug"` on a container establishes the scope. Inside it:
//   data-field="name"    — two-way binding to the store field. Reads flow
//                          from signals into the control; edits commit
//                          through the nearest data-commit mutation with
//                          coercion driven by the field's schema type.
//   data-commit="name"   — names the mutation edits travel through, on the
//                          control or any ancestor (a fieldset, a card).
//                          A field with no commit ancestor is read-only.
//
// Programmatic wiring stays available for anything richer (indexed array
// edits, cross-field payloads) — this covers the common form case with
// zero JavaScript.
import type { StoreDefinition, StoreValue } from '../types.js'
import { effect } from '@valencets/reactive'

const INPUT_DEBOUNCE_MS = 300

interface BindableStore {
  readonly signals: { [name: string]: { value: StoreValue } }
  readonly mutations: { [name: string]: (args: { [key: string]: StoreValue }) => Promise<{ isOk: () => boolean; isErr: () => boolean }> }
}

interface FieldBindingHandle {
  destroy (): void
}

type ValueControl = Element & { value: string }
type CheckedControl = Element & { checked: boolean }

function fieldTypeOf (config: StoreDefinition, name: string): string | null {
  for (const f of config.fields) {
    if (f.name === name) return f.type
  }
  return null
}

function containerSlug (el: Element): string | null {
  return el.closest('[data-store]')?.getAttribute('data-store') ?? null
}

function hasFocusWithin (el: Element): boolean {
  const active = document.activeElement
  return active !== null && (active === el || el.contains(active))
}

function writeControl (el: Element, fieldType: string, value: StoreValue): void {
  if (fieldType === 'boolean') {
    const checked = value === true
    if ('checked' in el) (el as CheckedControl).checked = checked
    if (checked) el.setAttribute('checked', '')
    else el.removeAttribute('checked')
    return
  }
  if ('value' in el) {
    (el as ValueControl).value = value === undefined || value === null ? '' : String(value)
  }
}

function readControl (el: Element, fieldType: string): StoreValue {
  if (fieldType === 'boolean') {
    return 'checked' in el ? (el as CheckedControl).checked === true : el.hasAttribute('checked')
  }
  const raw = 'value' in el ? (el as ValueControl).value : ''
  return fieldType === 'number' ? Number(raw) : raw
}

export function initFieldBinding (
  root: HTMLElement,
  stores: { [slug: string]: BindableStore },
  configs: { [slug: string]: StoreDefinition }
): FieldBindingHandle {
  // --- signals → controls -------------------------------------------------
  // One effect per store: reading every field signal registers the
  // dependencies, so any state change repaints all bound, unfocused
  // controls — including rows added after boot.
  const disposeEffects: Array<() => void> = []
  for (const [slug, store] of Object.entries(stores)) {
    const config = configs[slug]
    if (config === undefined) continue
    disposeEffects.push(effect(() => {
      const snapshot: { [name: string]: StoreValue } = {}
      for (const f of config.fields) {
        snapshot[f.name] = store.signals[f.name]?.value
      }
      for (const el of root.querySelectorAll('[data-field]')) {
        if (containerSlug(el) !== slug) continue
        const name = el.getAttribute('data-field') ?? ''
        const fieldType = fieldTypeOf(config, name)
        if (fieldType === null || hasFocusWithin(el)) continue
        writeControl(el, fieldType, snapshot[name])
      }
    }))
  }

  // --- controls → mutations ----------------------------------------------
  const debounces = new Map<Element, ReturnType<typeof setTimeout>>()

  function commit (el: Element): void {
    const name = el.getAttribute('data-field') ?? ''
    const slug = containerSlug(el)
    if (slug === null || name === '') return
    const store = stores[slug]
    const config = configs[slug]
    if (store === undefined || config === undefined) return

    const commitHost = el.closest('[data-commit]')
    const mutationName = commitHost?.getAttribute('data-commit') ?? null
    if (mutationName === null) return
    const mutation = store.mutations[mutationName]
    if (mutation === undefined) return

    const fieldType = fieldTypeOf(config, name)
    if (fieldType === null) return

    // Fire-and-forget: the pending queue owns retries/rollback; the trigger
    // affordance (is-pending/is-error) is the delegate's job, not binding's.
    mutation({ [name]: readControl(el, fieldType) }).then(() => undefined, () => undefined)
  }

  function boundField (event: Event): Element | null {
    if (!(event.target instanceof Element)) return null
    return event.target.closest('[data-field]')
  }

  const onChange = (event: Event): void => {
    const el = boundField(event)
    if (el === null) return
    const pending = debounces.get(el)
    if (pending !== undefined) {
      clearTimeout(pending)
      debounces.delete(el)
    }
    commit(el)
  }

  const onInput = (event: Event): void => {
    const el = boundField(event)
    if (el === null) return
    const pending = debounces.get(el)
    if (pending !== undefined) clearTimeout(pending)
    debounces.set(el, setTimeout(() => {
      debounces.delete(el)
      commit(el)
    }, INPUT_DEBOUNCE_MS))
  }

  root.addEventListener('change', onChange)
  root.addEventListener('input', onInput)

  return {
    destroy () {
      root.removeEventListener('change', onChange)
      root.removeEventListener('input', onInput)
      for (const pending of debounces.values()) clearTimeout(pending)
      debounces.clear()
      for (const dispose of disposeEffects) dispose()
    }
  }
}
