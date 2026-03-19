import type { CollectionConfig } from '@valencets/cms'
import { pascalCase, singularize } from '../codegen/naming.js'

export function generateDetailPage (collection: CollectionConfig): string {
  const singular = collection.labels?.singular ?? pascalCase(singularize(collection.slug))
  const titleField = collection.fields.find(f => f.type === 'text')?.name ?? 'id'
  const bodyField = collection.fields.find(f => f.type === 'richtext')?.name

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${singular}</title>
  <link rel="stylesheet" href="/src/app/styles.css">
  <style>
    .page { max-width: 720px; margin: 0 auto; padding: var(--val-space-8) var(--val-space-4); }
    .back {
      display: inline-block;
      color: var(--val-color-text-muted);
      font-size: var(--val-text-sm);
      margin-bottom: var(--val-space-4);
      text-decoration: none;
    }
    .back:hover { color: var(--val-color-primary); }
    .page h1 {
      font-size: var(--val-text-2xl);
      font-weight: var(--val-weight-bold);
      margin-bottom: var(--val-space-2);
    }
    .meta {
      font-size: var(--val-text-sm);
      color: var(--val-color-text-muted);
      margin-bottom: var(--val-space-6);
    }
    .body {
      line-height: var(--val-leading-relaxed);
      font-family: var(--val-font-sans);
    }
    .body h2 { font-size: var(--val-text-xl); margin: var(--val-space-4) 0 var(--val-space-2); }
    .body p { margin-bottom: var(--val-space-3); }
    .not-found { color: var(--val-color-text-muted); padding: var(--val-space-8) 0; }
  </style>
</head>
<body>
  <div class="page">
    <a class="back" href="/${collection.slug}">&larr; ${collection.labels?.plural ?? pascalCase(collection.slug)}</a>
    <div id="content"></div>
    <p class="not-found" id="not-found" hidden>${singular} not found.</p>
  </div>

  <script type="module">
    const id = window.location.pathname.split('/').pop()
    const res = await fetch('/api/${collection.slug}/' + id)
    const content = document.getElementById('content')
    const notFound = document.getElementById('not-found')
    if (res.ok) {
      const item = await res.json()
      const h1 = document.createElement('h1')
      h1.textContent = item.${titleField} ?? '${singular}'
      content.appendChild(h1)
      const meta = document.createElement('div')
      meta.className = 'meta'
      meta.textContent = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''
      content.appendChild(meta)
      ${bodyField
? `const body = document.createElement('div')
      body.className = 'body'
      // TRUST BOUNDARY: richtext content is HTML by design — sanitize if collection lacks auth
      body.innerHTML = item.${bodyField} ?? ''
      content.appendChild(body)`
: ''}
    } else {
      notFound.hidden = false
    }
  </script>
</body>
</html>
`
}
