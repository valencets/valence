# @valencets/valence

[![npm](https://img.shields.io/npm/v/@valencets/valence)](https://www.npmjs.com/package/@valencets/valence)
[![Socket](https://socket.dev/api/badge/npm/package/@valencets/valence)](https://socket.dev/npm/package/@valencets/valence)
[![License](https://img.shields.io/github/license/valencets/valence)](https://github.com/valencets/valence/blob/master/LICENSE)

CLI and runtime for the [Valence](https://github.com/valencets/valence) web framework. Define your schema in TypeScript -- get a database, admin UI, REST API, and analytics out of the box.

## Quick Start

```bash
npx @valencets/valence init my-site
cd my-site
pnpm dev
```

## Init Walkthrough

Running `valence init` walks you through an interactive setup:

```
$ npx @valencets/valence init my-site

  Welcome to Valence.

  Project name (my-site):
  Database name (my_site):
  Database user (postgres):
  Database password ():
  Server port (3000):

  Frontend framework:
    1. None (plain HTML templates)
    2. Astro (recommended for static + islands)
    3. Bring your own
  Choose (1):

  Install dependencies? (Y/n):
  Create database "my_site"? (Y/n):
  Run initial migrations? (Y/n):
  Insert sample seed data? (Y/n):
  Initialize git repository? (Y/n):
```

Each prompt has a sensible default shown in parentheses -- press Enter to accept. Pass `--yes` or `-y` to skip all prompts and use defaults (useful for CI and scripting).

### What gets scaffolded

```
my-site/
  valence.config.ts    # Collections, fields, DB config, admin settings
  package.json         # Dependencies and scripts
  tsconfig.json        # Strict TypeScript config
  migrations/
    001-init.sql       # Tables for categories, posts, pages, users
  collections/         # Custom collection files (empty, ready to extend)
  templates/           # HTML templates
  uploads/             # Media upload directory
  public/              # Static assets
  .env                 # DB credentials, port, CMS secret
  .gitignore
```

### Default collections

The init template includes four collections out of the box:

- **Categories** -- name, slug, description, color select
- **Posts** -- title, slug, richtext body, category relation, published boolean, date
- **Pages** -- title, slug, richtext content, status select (draft/published/archived), SEO group
- **Users** -- name, role (admin/editor), email, password (auth-enabled collection)

### Admin user

After init, create your admin user:

```bash
pnpm run user:create
```

This prompts for email, password, and name. The user is created with `role: 'admin'`.

## Commands

| Command | Description |
|---------|-------------|
| `valence init [name]` | Create a new project with interactive prompts |
| `valence init --learn` | Create a project with the interactive tutorial |
| `valence dev` | Start the development server |
| `valence migrate` | Run pending database migrations |
| `valence build` | Build for production |
| `valence user:create` | Create an admin user |
| `valence learn` | View learn mode status |
| `valence learn --reset` | Reset tutorial progress |
| `valence learn --off` | Disable learn mode |

## Learn Mode

New to Valence? Run `valence init --learn` to scaffold a project with an interactive 6-step tutorial built into the dev server. It teaches core concepts through real actions -- visiting the admin panel, creating content, hitting the API, adding a collection, and more.

Progress is tracked automatically via `.valence/learn.json`. The tutorial detects your actions (DB inserts, API requests, config file changes via `fs.watch`) and advances through steps as you complete them. No checkboxes -- just do the thing and it knows.

Access the tutorial at `http://localhost:3000/_learn` when the dev server is running.

## Telemetry

Valence ships with a complete first-party analytics pipeline. No Google Analytics, no Plausible, no vendor scripts. User behavior data is captured client-side with HTML `data-telemetry-*` attributes, flushed via `navigator.sendBeacon()`, and aggregated into daily summaries in your own Postgres.

The built-in analytics dashboard at `/admin/analytics` shows sessions, pageviews, conversions, top pages, and top referrers. Eleven intent types let you track conversion-oriented actions (calls, bookings, form submissions) natively.

See `@valencets/telemetry` and `@valencets/core` for the full API.

## Documentation

See the [full documentation](https://github.com/valencets/valence/wiki) for guides on collections, fields, auth, media, and telemetry.

## License

MIT
