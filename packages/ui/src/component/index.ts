// @valencets/ui/component — the defineComponent authoring surface (#373).
//
// This subpath takes the @valencets/reactive edge so user components get
// signals + bind() here, while the main @valencets/ui shell stays free of any
// reactive/store import — presentational val-* never drag it onto public pages.
// reactive is itself zero-dependency, so this introduces no third-party JS.

export { defineComponent } from './define-component.js'
export type {
  ComponentDefinition,
  ComponentPropSpec,
  ComponentContext,
  SetupArgs,
  SetupResult,
  DefinedComponent,
  PropType
} from './define-component.js'

// Re-exported so a component module imports everything from one place:
//   import { defineComponent, signal, computed } from '@valencets/ui/component'
export { signal, computed, effect, batch, untracked } from '@valencets/reactive'
export type { Signal, ReadonlySignal, SignalOptions } from '@valencets/reactive'
