<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./assets/logo-light.svg">
    <img alt="Valence" src="./assets/logo-light.svg" width="280">
  </picture>
</p>

<p align="center"><strong>Define the schema. Ship the site. Keep the data.</strong></p>

<p align="center">
  <a href="https://github.com/valencets/valence/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/valencets/valence/ci.yml?branch=master&label=CI" alt="CI"></a>
  <a href="https://github.com/valencets/valence/blob/master/LICENSE"><img src="https://img.shields.io/github/license/valencets/valence" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node >= 22">
  <img src="https://img.shields.io/badge/pnpm-10.x-F69220" alt="pnpm">
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript">
</p>

---

Valence is a schema-driven web framework for Node.js and PostgreSQL. One TypeScript schema gives you the database, admin UI, REST API, validation, and analytics. 18 native Web Components work in any framework or none. Zero third-party scripts in your visitor's browser.

## Quick Start

```bash
git clone https://github.com/valencets/valence.git
cd valence
pnpm install
pnpm build
pnpm test         # 1,028 tests
```

## Packages

| Package | What it does | Deps |
|---------|-------------|------|
| **@valencets/ui** | 18 Web Components + protocol base class. ARIA, i18n, telemetry hooks, CMS traceability, declarative hydration directives (`hydrate:idle`, `hydrate:visible`, `hydrate:media`, `hydrate:load`). OKLCH design tokens, optional Tailwind preset, theme contract. | zero |
| **@valencets/core** | Router, server, client telemetry engine. `pushState` nav, fragment swaps, hover-intent prefetch, ring buffer event capture. | zero |
| **@valencets/db** | PostgreSQL query layer. Tagged template SQL, parameterized by default, `Result<T,E>` returns, migration runner. | zero |
| **@valencets/cms** | Schema-driven content engine. `collection()` + `field.*` produces tables, Zod validators, REST API, admin UI, auth, media. | db |
| **@valencets/telemetry** | Beacon, ingestion, event storage, daily summaries. Zero third-party scripts. | db |

```
ui        standalone
core      standalone
db        standalone
cms       db
telemetry db
```

## Why Valence

- **Schema is the source of truth.** Define collections and fields in TypeScript. Valence derives tables, endpoints, admin views, validators, and migrations.
- **Native Web Components.** `val-*` elements use Custom Elements and `ElementInternals`. They work in React, Vue, Svelte, Astro, or plain HTML.
- **Built-in telemetry.** Every component dispatches interaction events. When nobody listens, zero cost. When `@valencets/telemetry` is active, one event listener captures everything.
- **Errors are values.** Every fallible operation returns `Result<T, E>`. No try/catch, no hidden failures.
- **14kB critical shell.** First paint ships in the first TCP round trip. No CDN dependencies, no web fonts, no third-party scripts.

## Constraints

| Rule | Why |
|------|-----|
| Complexity < 20 | Every function fits on one screen |
| `Result` monads | Errors visible in the type signature |
| 14kB critical shell | First paint, first packet |
| Pre-allocated ring buffer | Zero allocation in telemetry hot path |
| Zero `any`, strict mode | If it compiles, the types are right |
| Zero third-party browser JS | Your site, your code, your data |

## Documentation

- [Getting Started](docs/GETTING-STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Developer Guide](docs/DEVELOPER-GUIDE.md)
- [Contributing](CONTRIBUTING.md)
- [CMS Reference](packages/cms/README.md)
- [CMS Guide](packages/cms/docs/guide.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and the TDD workflow.

## License

MIT
