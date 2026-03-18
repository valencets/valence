import type { CollectionConfig } from '../schema/collection.js'
import { escapeHtml } from './escape.js'

interface LayoutArgs {
  readonly title: string
  readonly content: string
  readonly collections: readonly CollectionConfig[]
}

export function renderLayout (args: LayoutArgs): string {
  const navItems = args.collections.map(c => {
    const label = escapeHtml(c.labels?.plural ?? c.slug)
    return `<li><a href="/admin/${escapeHtml(c.slug)}">${label}</a></li>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(args.title)} — Valence CMS</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; min-height: 100vh; }
    nav { width: 240px; background: #1a1a2e; color: #eee; padding: 1rem; }
    nav a { color: #8ec5fc; text-decoration: none; display: block; padding: 0.5rem 0; }
    nav a:hover { color: #fff; }
    nav ul { list-style: none; }
    main { flex: 1; padding: 2rem; }
    h1 { margin-bottom: 1rem; }
  </style>
</head>
<body>
  <nav>
    <h2><a href="/admin">Valence CMS</a></h2>
    <ul>
${navItems}
    </ul>
  </nav>
  <main>
    <h1>${escapeHtml(args.title)}</h1>
    ${args.content}
  </main>
</body>
</html>`
}
