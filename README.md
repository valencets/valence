```
            __                    
 _   _____ / /__ ___  _______   
| | / / _ `/ / -_) _ \/ __/ -_) 
|_|/ /\_,_/_/\__/_//_/\__/\__/  
  |___/                          
```

**Define the schema. Ship the site. Keep the data.**

---

Valence is a web framework where the CMS, telemetry, and UI components aren't plugins you bolt on — they're the foundation you build on. One schema definition gives you the database, the admin, the validation, the API, and the analytics. No glue code. No third-party scripts in your visitor's browser. No framework lock-in.

It runs on Node.js and PostgreSQL. Deploy it wherever those run.

## Packages

| Package | What it does | Deps |
|---------|-------------|------|
| **@valencets/ui** | 18 Web Components + protocol base class. ARIA, i18n, telemetry emission, CMS traceability — baked in, not opt-in. | zero |
| **@valencets/core** | Router, server, client telemetry engine. `pushState` nav, fragment swaps, hover-intent prefetch, ring buffer event capture. | zero |
| **@valencets/db** | PostgreSQL query layer. Tagged template SQL, parameterized by default, `Result<T,E>` returns, migration runner. | zero |
| **@valencets/cms** | Schema-driven content engine. `collection()` + `field.*` → tables, Zod validators, REST API, admin UI, auth, media. | db |
| **@valencets/telemetry** | Beacon, ingestion, event storage, daily summaries. Zero third-party scripts. | db |

```
ui     ── standalone
core   ── standalone
db     ── standalone
cms    ── db
telemetry ── db
```

## The Opinionated Parts

**Schema is the source of truth.** You define collections and fields in TypeScript. Valence derives everything else — database tables, API endpoints, admin views, Zod validators, migration SQL. Change the schema, the system follows.

**Web Components, not framework components.** `val-*` elements are native Custom Elements with `ElementInternals`. They work in any HTML page, any framework, or no framework. Shadow DOM where isolation matters, light DOM where composition matters.

**Telemetry is a platform contract.** Every `val-*` component dispatches `val:interaction` events on user actions. Always. If nobody's listening, the events vanish — zero cost. When `@valencets/telemetry` is installed, it registers one `document.addEventListener` and captures everything. The UI package doesn't know or care.

**Errors are values.** Every fallible operation returns `Result<T, E>`. No try/catch, no uncaught promise rejections, no hidden failure modes.

**Nothing in the browser you didn't write.** No analytics scripts, no tracking pixels, no CDN dependencies. The critical shell is 14kB. First paint in the first TCP data flight.

## Quick Start

```bash
git clone https://github.com/valencets/valence.git
cd valence
pnpm install
pnpm build
pnpm test         # 920+ tests
```

## Constraints

| Rule | Why |
|------|-----|
| Complexity < 20 | Every function fits on one screen |
| `Result` monads | Errors visible in the type signature |
| 14kB critical shell | First paint, first packet |
| Pre-allocated ring buffer | Zero allocation in telemetry hot path |
| Zero `any`, strict mode | If it compiles, the types are right |
| Zero third-party browser JS | Your site, your code, your data |

## Docs

- [Getting Started](docs/GETTING-STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Developer Guide](docs/DEVELOPER-GUIDE.md)
- [Contributing](CONTRIBUTING.md)
- [CMS Reference](packages/cms/README.md)

## License

MIT
