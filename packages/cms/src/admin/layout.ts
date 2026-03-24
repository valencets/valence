import type { CollectionConfig } from '../schema/collection.js'
import { CSP_NONCE_PLACEHOLDER } from '@valencets/core/server'
import type { FlashMessage } from './flash.js'
import { escapeHtml } from './escape.js'
import { renderToast } from './toast.js'
import { getCriticalCss } from './km-theme.js'

interface LayoutArgs {
  readonly title: string
  readonly content: string
  readonly collections: readonly CollectionConfig[]
  readonly toast?: FlashMessage | undefined
  readonly nonce?: string | undefined
  readonly headTags?: readonly string[] | undefined
}

export function renderAdminLayout (args: LayoutArgs): string {
  const visible = args.collections.filter(c => c.admin?.hidden !== true)
  const sorted = [...visible].sort((a, b) => {
    const posA = a.admin?.position ?? Infinity
    const posB = b.admin?.position ?? Infinity
    return posA - posB
  })

  const ungrouped = sorted.filter(c => c.admin?.group == null)
  const groupMap = new Map<string, readonly CollectionConfig[]>()
  for (const c of sorted) {
    const g = c.admin?.group
    if (g != null) {
      const existing = groupMap.get(g) ?? []
      groupMap.set(g, [...existing, c])
    }
  }

  const renderNavItem = (c: CollectionConfig): string => {
    const label = escapeHtml(c.labels?.plural ?? c.slug)
    return `<li><a href="/admin/${escapeHtml(c.slug)}">${label}</a></li>`
  }

  const ungroupedNav = ungrouped.map(renderNavItem).join('\n')
  const groupedNav = [...groupMap.entries()].map(([group, cols]) => {
    const heading = `<li class="nav-group-heading">${escapeHtml(group)}</li>`
    const items = cols.map(renderNavItem).join('\n')
    return heading + '\n' + items
  }).join('\n')

  const collectionNav = ungroupedNav + (groupedNav ? '\n' + groupedNav : '')
  const analyticsItem = '\n<li style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--val-color-border);"><a href="/admin/analytics">Analytics</a></li>'
  const logoutItem = '\n<li style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--val-color-border);"><form method="POST" action="/admin/logout" style="margin:0;"><button type="submit" class="sidebar-logout-btn" style="display:block;width:100%;padding:0.5rem 0.75rem;border-radius:var(--val-radius-md);color:var(--val-color-text-muted);font-size:var(--val-text-sm);font-weight:var(--val-weight-medium);background:none;border:none;cursor:pointer;text-align:left;">Log out</button></form></li>'
  const navItems = collectionNav + analyticsItem + logoutItem

  const toastHtml = args.toast ? renderToast(args.toast) : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(args.title)} — Valence CMS</title>
  ${/* headTags: trusted developer-only config from AdminOptions — NOT user input */ ''}${(args.headTags ?? []).join('\n  ')}
  <link rel="stylesheet" href="/admin/_assets/admin.css">
  <style nonce="${args.nonce ?? CSP_NONCE_PLACEHOLDER}">${getCriticalCss()}</style>
</head>
<body>
  <nav class="sidebar">
    <a href="/admin" class="sidebar-brand">Valence CMS</a>
    <ul>
${navItems}
    </ul>
  </nav>
  <main class="main">
    ${toastHtml}
    <h1>${escapeHtml(args.title)}</h1>
    ${args.content}
  </main>
  ${toastHtml
    ? `<script${args.nonce ? ` nonce="${args.nonce}"` : ' nonce="' + CSP_NONCE_PLACEHOLDER + '"'}>
    (function () {
      var t = document.querySelector('.toast')
      if (!t) return
      var btn = t.querySelector('.toast-dismiss')
      if (btn) btn.addEventListener('click', function () { t.classList.add('toast-fade'); setTimeout(function () { t.remove() }, 200) })
      setTimeout(function () { t.classList.add('toast-fade'); setTimeout(function () { t.remove() }, 200) }, 5000)
    })()
  </script>`
    : ''}
  <script type="module" src="/admin/_assets/admin-client.js"${args.nonce ? ` nonce="${args.nonce}"` : ' nonce="' + CSP_NONCE_PLACEHOLDER + '"'}></script>
</body>
</html>`
}
