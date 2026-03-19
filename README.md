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
  <img src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <a href="https://github.com/neostandard/neostandard"><img src="https://img.shields.io/badge/code_style-neostandard-brightgreen?style=flat" alt="neostandard"></a>
</p>

---

> **valence** /ˈveɪləns/ *n.* — in chemistry, the outermost electrons of an atom. The part that actually bonds with the world. Everything else is buried inside.

Most frameworks hand you a skeleton and a plugin catalog. The CMS is a third-party install. The analytics is a vendor script. The component library needs its own build pipeline. You spend your time wiring seams together and debugging the gaps between things that were never designed to talk to each other.

Valence puts the bonding layer first. Define collections and fields in TypeScript. The database tables, admin UI, REST API, validators, and migrations all derive from that single schema. 18 native Web Components work in any HTML page. Telemetry writes to your Postgres, not someone else's SaaS dashboard. Nothing phones home.

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
| **@valencets/ui** | 18 Web Components. ARIA, i18n, telemetry hooks, hydration directives. OKLCH tokens, Tailwind preset, theme contract. | zero |
| **@valencets/core** | Router + server. `pushState` nav, fragment swaps, hover-intent prefetch, ring buffer event capture. | zero |
| **@valencets/db** | PostgreSQL query layer. Tagged template SQL, parameterized by default, `Result<T,E>` returns, migration runner. | zero |
| **@valencets/cms** | Schema engine. `collection()` + `field.*` produces tables, Zod validators, REST API, admin UI, auth, media. | db |
| **@valencets/telemetry** | Beacon, ingestion, event storage, daily summaries. Your data in your database. | db |

```
ui        standalone
core      standalone
db        standalone
cms       db
telemetry db
```

---

**One schema.** Collections and fields in TypeScript. Tables, endpoints, admin views, validators, migrations. All derived. Change the schema, everything follows.

**Your code in their browser.** 14kB critical shell. First paint in the first TCP round trip. No CDN dependencies. No web fonts from Google. No third-party scripts. Ever.

**Errors are values.** `Result<T, E>` on every fallible operation. Both branches handled or it doesn't compile. No try/catch. No "works on my machine."

**Real components.** Custom Elements with `ElementInternals`. Work in React, Vue, Svelte, Astro, plain HTML. No virtual DOM. No framework lock-in.

**Your data.** Telemetry captures interaction events into your Postgres. Not Mixpanel's. Not Google's. Yours.

---

## Non-Negotiable

| Rule | |
|------|---|
| Complexity < 20 | Every function fits on one screen. No exceptions. |
| `Result<T, E>` everywhere | If it can fail, the type signature says so. |
| 14kB critical shell | First paint in the first TCP data flight. |
| Pre-allocated ring buffer | Zero allocation in the telemetry hot path. |
| Zero `any`, strict mode | If it compiles, the types are right. |
| Zero third-party browser JS | Your site. Your code. Your data. |

## Documentation

- [Getting Started](docs/GETTING-STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Developer Guide](docs/DEVELOPER-GUIDE.md)
- [CMS Reference](packages/cms/README.md)
- [CMS Guide](packages/cms/docs/guide.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, standards, and the TDD workflow.

## License

MIT
