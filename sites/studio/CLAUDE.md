# sites/studio

The studio website — first production deployment of the Inertia framework.

## Directory Structure

```
studio/
├── features/           # Feature modules (self-contained)
│   └── <feature-name>/
│       ├── components/    Web Components (Custom Elements)
│       ├── templates/     HTML fragments returned by server routes
│       ├── server/        Server-side route handlers (return HTML, not JSON)
│       ├── types/         TypeScript interfaces (monomorphic, explicit)
│       ├── schemas/       Zod schemas (.safeParse() only)
│       ├── telemetry/     Feature-specific IntentType definitions and data-* contracts
│       └── config/        Constants and static dictionary maps
├── server/             # Server entry point, middleware, shared config
├── public/             # Static assets (fonts, images, favicon)
└── pages/              # Top-level page shells (minimal — logic lives in features)
```

## Feature Rules

- Not every feature needs all subdirectories. Only create what you use.
- No feature should contain `try/catch`, `switch`, framework imports, or direct DOM mutation outside the router's fragment swap cycle.
- Features coordinate through the telemetry ring buffer or server-delivered HTML, not client-side stores.
- Server routes return HTML fragments, not JSON. The router handles swap mechanics.
- Feature-specific Web Components register with `inertia-` prefix and delegate telemetry via `data-*` attributes.

## TDD Protocol

Write tests BEFORE implementation. Every feature follows red-green-refactor:

1. Write a failing test that specifies the behavior
2. Write the minimum code to make it pass
3. Refactor while keeping tests green

Tests live in `features/<feature-name>/__tests__/` alongside the feature they cover.
