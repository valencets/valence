# packages/components

Native Web Component primitives. Zero framework runtime. Browser-native encapsulation.

## Rules

- Every component extends `HTMLElement` and registers via `customElements.define()`
- Components are pure rendering endpoints. No business logic. No direct tracking calls.
- Telemetry dispatched via `data-*` attributes and event delegation (handled by `packages/core`)
- Implement `connectedMoveCallback()` on any component that must survive router transitions
- Use `Element.moveBefore()` for persistent components, never `appendChild()` during swaps
- Use Scoped Custom Element Registries when injecting from separate HTML payloads

## Accessibility

Follow Radix UI patterns adapted for Web Components: proper ARIA attributes, keyboard navigation, focus management. Accessibility is not optional.

## Naming

- File: `PascalCase.ts` (e.g., `TrackingButton.ts`)
- Tag: `kebab-case` with `inertia-` prefix (e.g., `<inertia-button>`)
- Class: `PascalCase` (e.g., `class TrackingButton extends HTMLElement`)
