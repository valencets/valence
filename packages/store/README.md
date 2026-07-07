# @valencets/store

Schema-driven shared state for [Valence](https://github.com/valencets/valence).
One store definition — fields, mutations, derived values, an optional
fragment — and the framework derives Zod validation on both sides, typed
signals, per-mutation endpoints, an SSE channel, optimistic updates with
server reconciliation, hydration, and declarative DOM binding.

```ts
import { field } from '@valencets/store'
import type { StoreInput } from '@valencets/store'

export const cart: StoreInput = {
  slug: 'cart',
  scope: 'session',      // page | session | user | global — who shares it
  persist: true,         // survive restarts in postgres
  fields: [field.array({ name: 'items', fields: [/* … */] })],
  mutations: {
    addItem: {
      input: [field.text({ name: 'sku', required: true })],
      server: async ({ state, input, pool }) => { /* server truth */ },
      client: ({ state, input }) => { /* optional optimistic apply */ }
    }
  },
  fragment: (state) => `<span>${(state.items as unknown[]).length}</span>`
}
```

```html
<section data-store="cart">
  <fieldset data-commit="updateQuantity">
    <input data-field="qty" type="number">
  </fieldset>
  <button data-mutation="addItem" data-args='{"sku":"abc"}'>Add</button>
  <div data-fragment></div>
</section>
```

The scope is the architecture: `page` never touches the server, `session`
follows the visitor's tabs, `user` follows the account across devices,
`global` is one shared copy for everyone — same client API throughout.
Mutations carry intent, the server linearizes them, and the client rebases
its pending queue on every authoritative response.

Used through the `stores` array in `valence.config.ts`; see the
[store documentation](https://github.com/valencets/valence/blob/master/docs/STORES.md)
for the full contract.
