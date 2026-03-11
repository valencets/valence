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

## TDD Protocol

Write tests BEFORE implementation. Every feature follows red-green-refactor:

1. Write a failing test that specifies the behavior
2. Write the minimum code to make it pass
3. Refactor while keeping tests green

### Test Coverage Requirements

- Lifecycle: test `connectedCallback`, `disconnectedCallback`, `connectedMoveCallback`
- Attributes: test `observedAttributes` and `attributeChangedCallback` for every observed attr
- Accessibility: verify ARIA attributes, keyboard navigation, focus management
- Delegation: confirm `data-*` attributes are set correctly for event delegation
- Isolation: test Shadow DOM encapsulation where used
- Router survival: verify `moveBefore()` preserves component state across swaps

### LOC Targets

| Module | Estimated LOC | Test LOC |
|---|---|---|
| `BaseComponent.ts` | ~60 | ~100 |
| `TrackingButton.ts` | ~40 | ~80 |
| `PhoneLink.ts` (DNI) | ~50 | ~80 |
| `FormCapture.ts` | ~70 | ~100 |

Tests should be ~1.5x the implementation LOC.

## Development Order

Build base component first, then concrete components in priority order: tracking button → phone link (DNI) → form capture. Each component is test-driven and merged only when all tests pass.
