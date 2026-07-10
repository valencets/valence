// defineComponent — the factory that makes a user-authored Web Component
// "fully Valence" (#373). It is a thin declarative wrapper over ValElement, so
// a user's component inherits hydration directives, telemetry, i18n, design
// tokens, and ARIA for free, and gains reactive signals + data-bind templating.
//
// The component model IS the Web Component — no VDOM, no SFC compiler. The
// template is a plain string with `data-bind` markers resolved against the
// signals and handlers that setup() returns, reusing the same `data-*` mental
// model and the same reactive bind() plumbing that stores use.

import { ValElement } from '../core/val-element.js'
import { bind, computed } from '@valencets/reactive'
import type { Signal, ReadonlySignal, BindingMap } from '@valencets/reactive'

export type PropType = 'string' | 'number' | 'boolean'

export interface ComponentPropSpec {
  readonly type: PropType
  readonly default?: string | number | boolean
}

type PropRuntime<S extends ComponentPropSpec> =
  S['type'] extends 'number' ? number
    : S['type'] extends 'boolean' ? boolean
      : string

type PropsOf<D extends Readonly<Record<string, ComponentPropSpec>>> = {
  readonly [K in keyof D]: PropRuntime<D[K]>
}

/** The declarative surface handed to setup(), mirroring ValElement's pillars. */
export interface ComponentContext {
  readonly host: HTMLElement
  /** Fire a telemetry interaction (val:interaction) — see ValElement. */
  readonly emit: (action: string, detail?: Record<string, string | number | boolean>) => void
  /** Current locale from the shared locale observer. */
  readonly locale: string
}

export interface SetupArgs<P> {
  readonly props: P
  readonly ctx: ComponentContext
}

/** setup() returns named signals (bound to text/value/…) and handlers (bound to on*). */
export type SetupResult = { readonly [key: string]: unknown }

export interface ComponentDefinition<D extends Readonly<Record<string, ComponentPropSpec>>> {
  /** Custom-element tag — must contain a hyphen. */
  readonly tag: string
  readonly props?: D
  /** Template string; `data-bind` markers wire it to setup()'s result. */
  readonly template: string
  /** Scoped CSS injected into the shadow root (token-aware). */
  readonly styles?: string
  /** Shadow DOM on by default; set false for light-DOM components. */
  readonly shadow?: boolean
  readonly setup?: (args: SetupArgs<PropsOf<D>>) => SetupResult
}

export interface DefinedComponent {
  readonly tag: string
  readonly element: CustomElementConstructor
  /** Idempotent customElements.define(tag, element). */
  readonly define: () => void
}

// --- data-bind parsing ---

interface Directive {
  readonly kind: string
  readonly name: string | null
  readonly key: string
}

// "text:count, class:open:isOpen, onclick:inc" → structured directives.
function parseBindings (raw: string): readonly Directive[] {
  const out: Directive[] = []
  for (const token of raw.split(',')) {
    const parts = token.trim().split(':').map(p => p.trim())
    const kind = parts[0]
    const a = parts[1]
    const b = parts[2]
    if (kind === undefined || kind === '' || a === undefined || a === '') continue
    if (parts.length === 2) {
      out.push({ kind, name: null, key: a })
    } else if (parts.length === 3 && b !== undefined && b !== '') {
      out.push({ kind, name: a, key: b })
    }
  }
  return out
}

// --- value resolution ---

function isReadableSignal (value: unknown): boolean {
  return typeof value === 'object' && value !== null &&
    'peek' in value && typeof (value as { peek?: unknown }).peek === 'function'
}

function toText (value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return String(value)
}

// A mutable BindingMap we assemble per element, then hand to bind().
interface MutableBindingMap {
  text?: ReadonlySignal<string>
  value?: Signal<string>
  checked?: Signal<boolean>
  visible?: ReadonlySignal<boolean>
  class?: { [name: string]: ReadonlySignal<boolean> }
  attr?: { [name: string]: ReadonlySignal<string | null> }
}

function addSignalBinding (map: MutableBindingMap, d: Directive, raw: unknown): void {
  const sig = raw as ReadonlySignal<unknown>
  if (d.kind === 'text') {
    map.text = computed(() => toText(sig.value))
    return
  }
  if (d.kind === 'value') {
    map.value = raw as Signal<string>
    return
  }
  if (d.kind === 'checked') {
    map.checked = raw as Signal<boolean>
    return
  }
  if (d.kind === 'visible') {
    map.visible = computed(() => Boolean(sig.value))
    return
  }
  if (d.kind === 'class' && d.name !== null) {
    const bag = map.class ?? {}
    bag[d.name] = computed(() => Boolean(sig.value))
    map.class = bag
    return
  }
  if (d.kind === 'attr' && d.name !== null) {
    const bag = map.attr ?? {}
    bag[d.name] = computed(() => {
      const v = sig.value
      return (v === null || v === undefined) ? null : toText(v)
    })
    map.attr = bag
  }
}

const EVENT_PREFIX = 'on'

function wireElement (node: Element, directives: readonly Directive[], result: SetupResult): () => void {
  const map: MutableBindingMap = {}
  const disposers: Array<() => void> = []

  for (const d of directives) {
    const raw = result[d.key]
    if (d.kind.startsWith(EVENT_PREFIX) && typeof raw === 'function') {
      const type = d.kind.slice(EVENT_PREFIX.length)
      const handler = raw as (e: Event) => void
      node.addEventListener(type, handler)
      disposers.push(() => { node.removeEventListener(type, handler) })
      continue
    }
    if (isReadableSignal(raw)) {
      addSignalBinding(map, d, raw)
    }
  }

  const stop = bind(node, map as BindingMap)
  disposers.push(stop)
  return () => { for (const dispose of disposers) dispose() }
}

// --- the generated element class ---

function coerceProp (spec: ComponentPropSpec, attr: string | null): string | number | boolean {
  if (spec.type === 'number') {
    return attr === null ? Number(spec.default ?? 0) : Number(attr)
  }
  if (spec.type === 'boolean') {
    return attr === null ? Boolean(spec.default ?? false) : attr !== 'false'
  }
  return attr === null ? String(spec.default ?? '') : attr
}

function buildElementClass<D extends Readonly<Record<string, ComponentPropSpec>>> (
  definition: ComponentDefinition<D>
): CustomElementConstructor {
  const propEntries = Object.entries(definition.props ?? {})
  const useShadow = definition.shadow !== false

  class GeneratedComponent extends ValElement {
    private _disposers: Array<() => void> = []

    constructor () {
      super({ shadow: useShadow })
    }

    protected createTemplate (): HTMLTemplateElement {
      const template = document.createElement('template')
      const style = definition.styles !== undefined ? `<style>${definition.styles}</style>` : ''
      template.innerHTML = style + definition.template
      return template
    }

    connectedCallback (): void {
      super.connectedCallback()
      // Wait for deferred hydration directives (hydrate:idle/visible/media) to
      // resolve; ValElement re-invokes this once the element is live.
      if (!this.hydrated) return
      if (this._disposers.length > 0) return
      this._wire()
    }

    disconnectedCallback (): void {
      for (const dispose of this._disposers) dispose()
      this._disposers = []
      super.disconnectedCallback()
    }

    private _readProps (): PropsOf<D> {
      const values: { [key: string]: string | number | boolean } = {}
      for (const [name, spec] of propEntries) {
        values[name] = coerceProp(spec, this.getAttribute(name))
      }
      return values as PropsOf<D>
    }

    private _wire (): void {
      const root: ParentNode = this.shadowRoot ?? this
      const ctx: ComponentContext = {
        host: this,
        emit: (action, detail) => { this.emitInteraction(action, detail) },
        locale: this.locale
      }
      const result = definition.setup !== undefined
        ? definition.setup({ props: this._readProps(), ctx })
        : {}
      for (const node of root.querySelectorAll('[data-bind]')) {
        const raw = node.getAttribute('data-bind')
        if (raw === null) continue
        this._disposers.push(wireElement(node, parseBindings(raw), result))
      }
    }
  }

  Object.defineProperty(GeneratedComponent, 'observedAttributes', {
    value: propEntries.map(([name]) => name)
  })
  return GeneratedComponent
}

export function defineComponent<D extends Readonly<Record<string, ComponentPropSpec>> = Record<string, never>> (
  definition: ComponentDefinition<D>
): DefinedComponent {
  const element = buildElementClass(definition)
  const tag = definition.tag
  return {
    tag,
    element,
    define: () => {
      if (customElements.get(tag) === undefined) {
        customElements.define(tag, element)
      }
    }
  }
}
