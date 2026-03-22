import type { CollectionConfig } from '../schema/collection.js'
import { CSP_NONCE_PLACEHOLDER } from '@valencets/core/server'
import type { FlashMessage } from './flash.js'
import { escapeHtml } from './escape.js'
import { renderToast } from './toast.js'

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
  ${(args.headTags ?? []).join('\n  ')}
  <style>
    /* --- Primitive tokens (inlined from @valencets/ui) --- */
    :root {
      --val-gray-50: oklch(0.9846 0.0017 247.84);
      --val-gray-100: oklch(0.9670 0.0029 264.54);
      --val-gray-200: oklch(0.9276 0.0058 264.53);
      --val-gray-300: oklch(0.8717 0.0093 258.34);
      --val-gray-400: oklch(0.7137 0.0192 261.32);
      --val-gray-500: oklch(0.5510 0.0234 264.36);
      --val-gray-600: oklch(0.4461 0.0263 256.80);
      --val-gray-700: oklch(0.3729 0.0306 259.73);
      --val-gray-800: oklch(0.2781 0.0296 256.85);
      --val-gray-900: oklch(0.2101 0.0318 264.66);
      --val-gray-950: oklch(0.1296 0.0274 261.69);
      --val-blue-400: oklch(0.7137 0.1434 254.62);
      --val-blue-500: oklch(0.6231 0.1880 259.81);
      --val-blue-600: oklch(0.5461 0.2152 262.88);
      --val-blue-700: oklch(0.4882 0.2172 264.38);
      --val-red-500: oklch(0.6368 0.2078 25.33);
      --val-green-500: oklch(0.7227 0.1920 149.58);
      --val-font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --val-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      --val-text-xs: 0.75rem;
      --val-text-sm: 0.875rem;
      --val-text-base: 1rem;
      --val-text-lg: 1.125rem;
      --val-text-xl: 1.25rem;
      --val-text-2xl: 1.5rem;
      --val-leading-tight: 1.25;
      --val-leading-normal: 1.5;
      --val-weight-normal: 400;
      --val-weight-medium: 500;
      --val-weight-semibold: 600;
      --val-weight-bold: 700;
      --val-radius-sm: 0.25rem;
      --val-radius-md: 0.375rem;
      --val-radius-lg: 0.5rem;
      --val-shadow-sm: 0 1px 2px 0 oklch(0 0 0 / 0.05);
      --val-shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
      --val-duration-fast: 100ms;
      --val-duration-normal: 200ms;
      --val-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* --- Semantic tokens (forced dark) --- */
    :root {
      --val-color-bg: var(--val-gray-950);
      --val-color-bg-elevated: var(--val-gray-900);
      --val-color-bg-muted: var(--val-gray-800);
      --val-color-text: var(--val-gray-50);
      --val-color-text-muted: var(--val-gray-400);
      --val-color-primary: var(--val-blue-600);
      --val-color-primary-hover: var(--val-blue-700);
      --val-color-primary-text: oklch(1 0 0);
      --val-color-border: var(--val-gray-700);
      --val-color-border-focus: var(--val-blue-500);
      --val-focus-ring: 0 0 0 2px var(--val-color-bg), 0 0 0 4px var(--val-color-border-focus);
      --val-color-error: var(--val-red-500);
      --val-color-success: var(--val-green-500);
    }

    /* --- Reset --- */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* --- Base --- */
    body {
      font-family: var(--val-font-sans);
      font-size: var(--val-text-base);
      line-height: var(--val-leading-normal);
      color: var(--val-color-text);
      background: var(--val-color-bg);
      display: flex;
      min-height: 100vh;
    }

    a { color: var(--val-blue-400); text-decoration: none; }
    a:hover { color: var(--val-color-primary-text); }

    /* --- Sidebar --- */
    .sidebar {
      width: 240px;
      flex-shrink: 0;
      background: var(--val-color-bg-elevated);
      border-right: 1px solid var(--val-color-border);
      padding: 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .sidebar-brand {
      font-size: var(--val-text-lg);
      font-weight: var(--val-weight-bold);
      color: var(--val-color-text);
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    .sidebar-brand:hover { color: var(--val-blue-400); }

    .sidebar ul { list-style: none; display: flex; flex-direction: column; gap: 0.25rem; }

    .nav-group-heading {
      font-size: var(--val-text-xs);
      font-weight: var(--val-weight-semibold);
      color: var(--val-color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.75rem 0.75rem 0.25rem;
      margin-top: 0.5rem;
    }

    .sidebar a {
      display: block;
      padding: 0.5rem 0.75rem;
      border-radius: var(--val-radius-md);
      color: var(--val-color-text-muted);
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      transition: background var(--val-duration-fast) var(--val-ease-in-out),
                  color var(--val-duration-fast) var(--val-ease-in-out);
    }
    .sidebar a:hover {
      background: var(--val-color-bg-muted);
      color: var(--val-color-text);
    }

    /* --- Main --- */
    .main {
      flex: 1;
      padding: 2rem 2.5rem;
      min-width: 0;
    }

    .main > h1 {
      font-size: var(--val-text-2xl);
      font-weight: var(--val-weight-bold);
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }

    /* --- Cards --- */
    .dashboard { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .card {
      background: var(--val-color-bg-elevated);
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-lg);
      padding: 1.25rem;
      box-shadow: var(--val-shadow-sm);
      transition: border-color var(--val-duration-fast) var(--val-ease-in-out),
                  box-shadow var(--val-duration-fast) var(--val-ease-in-out);
    }
    .card:hover { border-color: var(--val-blue-500); box-shadow: var(--val-shadow-md); }
    .card a { color: var(--val-color-text); text-decoration: none; display: block; }
    .card h3 { font-size: var(--val-text-lg); font-weight: var(--val-weight-semibold); }

    /* --- Tables --- */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--val-text-sm);
      margin-top: 1rem;
    }
    th {
      text-align: left;
      padding: 0.625rem 0.75rem;
      font-weight: var(--val-weight-semibold);
      color: var(--val-color-text-muted);
      font-size: var(--val-text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--val-color-border);
    }
    td {
      padding: 0.625rem 0.75rem;
      border-bottom: 1px solid var(--val-color-border);
    }
    tr:hover td { background: var(--val-color-bg-elevated); }

    /* --- Forms --- */
    .admin-form { max-width: 640px; display: flex; flex-direction: column; gap: 1.25rem; }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .form-field > span {
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      color: var(--val-color-text-muted);
    }

    .form-input, .form-select, .form-textarea {
      background: var(--val-color-bg-muted);
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-md);
      padding: 0.5rem 0.75rem;
      color: var(--val-color-text);
      font-family: var(--val-font-sans);
      font-size: var(--val-text-sm);
      transition: border-color var(--val-duration-fast) var(--val-ease-in-out),
                  box-shadow var(--val-duration-fast) var(--val-ease-in-out);
    }
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      outline: none;
      border-color: var(--val-color-border-focus);
      box-shadow: var(--val-focus-ring);
    }
    .form-textarea { min-height: 120px; resize: vertical; }
    .form-select { appearance: none; cursor: pointer; }

    .form-checkbox {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--val-text-sm);
      color: var(--val-color-text);
      cursor: pointer;
    }
    .form-checkbox input[type="checkbox"] {
      width: 1rem;
      height: 1rem;
      accent-color: var(--val-color-primary);
      cursor: pointer;
    }

    fieldset {
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-lg);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    fieldset legend {
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-semibold);
      color: var(--val-color-text-muted);
      padding: 0 0.5rem;
    }

    /* --- Buttons --- */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-semibold);
      font-family: var(--val-font-sans);
      border-radius: var(--val-radius-md);
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: background var(--val-duration-fast) var(--val-ease-in-out);
    }
    .btn-primary {
      background: var(--val-color-primary);
      color: var(--val-color-primary-text);
    }
    .btn-primary:hover { background: var(--val-color-primary-hover); color: var(--val-color-primary-text); }
    .btn-danger {
      background: var(--val-color-error);
      color: oklch(1 0 0);
    }
    .btn-danger:hover { background: oklch(0.55 0.22 25); }

    .empty-state {
      color: var(--val-color-text-muted);
      padding: 2rem 0;
    }
    .empty-state a { color: var(--val-blue-400); }

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* --- Toast --- */
    .toast {
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--val-radius-md);
      box-shadow: var(--val-shadow-md);
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      color: var(--val-color-text);
      z-index: 1000;
      transition: opacity var(--val-duration-normal) var(--val-ease-in-out);
    }
    .toast-error { background: var(--val-color-error); }
    .toast-success { background: var(--val-color-success); }
    .toast-info { background: var(--val-blue-500); }
    .toast-dismiss {
      background: none;
      border: none;
      color: inherit;
      font-size: var(--val-text-lg);
      cursor: pointer;
      padding: 0;
      line-height: 1;
      opacity: 0.8;
    }
    .toast-dismiss:hover { opacity: 1; }
    .toast-fade { opacity: 0; }

    /* --- Richtext Editor --- */
    .richtext-wrap {
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-md);
      overflow: hidden;
    }
    .richtext-toolbar {
      display: flex;
      gap: 0.25rem;
      padding: 0.375rem 0.5rem;
      background: var(--val-color-bg-muted);
      border-bottom: 1px solid var(--val-color-border);
    }
    .richtext-toolbar-btn {
      background: none;
      border: 1px solid transparent;
      border-radius: var(--val-radius-sm);
      color: var(--val-color-text-muted);
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-bold);
      padding: 0.25rem 0.5rem;
      cursor: pointer;
      font-family: var(--val-font-sans);
    }
    .richtext-toolbar-btn:hover {
      background: var(--val-color-bg-elevated);
      color: var(--val-color-text);
    }
    .richtext-toolbar-btn--active {
      background: var(--val-color-bg-elevated);
      color: var(--val-color-text);
      border-color: var(--val-color-border);
    }
    .richtext-editor {
      min-height: 200px;
    }
    .ProseMirror {
      min-height: 200px;
      padding: 0.75rem;
      background: var(--val-color-bg-muted);
      color: var(--val-color-text);
      font-family: var(--val-font-sans);
      font-size: var(--val-text-sm);
      line-height: var(--val-leading-normal);
      outline: none;
    }
    .ProseMirror:focus {
      box-shadow: inset 0 0 0 2px var(--val-color-border-focus);
    }
    .ProseMirror p { margin-bottom: 0.5rem; }
    .ProseMirror h2 { font-size: var(--val-text-xl); font-weight: var(--val-weight-bold); margin: 1rem 0 0.5rem; }
    .ProseMirror h3 { font-size: var(--val-text-lg); font-weight: var(--val-weight-semibold); margin: 0.75rem 0 0.5rem; }
    .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; margin-bottom: 0.5rem; }
    .ProseMirror blockquote {
      border-left: 3px solid var(--val-color-border);
      padding-left: 0.75rem;
      color: var(--val-color-text-muted);
      margin: 0.5rem 0;
    }
    .ProseMirror a { color: var(--val-blue-400); text-decoration: underline; }
    .ProseMirror code {
      background: var(--val-color-bg-elevated);
      padding: 0.125rem 0.375rem;
      border-radius: var(--val-radius-sm);
      font-family: var(--val-font-mono);
      font-size: 0.85em;
    }
    .ProseMirror hr {
      border: none;
      border-top: 2px solid var(--val-color-border);
      margin: 1rem 0;
    }
    .ProseMirror pre {
      background: var(--val-color-bg-elevated);
      padding: 0.75rem;
      border-radius: var(--val-radius-md);
      font-family: var(--val-font-mono);
      font-size: 0.85em;
      overflow-x: auto;
      margin: 0.5rem 0;
    }
    .ProseMirror pre code {
      background: none;
      padding: 0;
      border-radius: 0;
    }
    .form-json {
      min-height: 120px;
      resize: vertical;
      background: var(--val-color-bg-muted);
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-md);
      padding: 0.5rem 0.75rem;
      color: var(--val-color-text);
      font-family: var(--val-font-mono);
      font-size: var(--val-text-sm);
      line-height: var(--val-leading-normal);
    }
    .form-json:focus {
      outline: none;
      border-color: var(--val-color-border-focus);
      box-shadow: var(--val-focus-ring);
    }
    .array-field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .array-add {
      align-self: flex-start;
      background: var(--val-color-bg-muted);
      border: 1px dashed var(--val-color-border);
      border-radius: var(--val-radius-md);
      padding: 0.375rem 0.75rem;
      color: var(--val-color-text-muted);
      font-size: var(--val-text-sm);
      cursor: pointer;
    }
    .array-add:hover {
      border-color: var(--val-blue-500);
      color: var(--val-color-text);
    }


    /* --- Blocks field --- */
    .blocks-field {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .blocks-item {
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-lg);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .blocks-item legend {
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-semibold);
      color: var(--val-color-text-muted);
      padding: 0 0.5rem;
    }
    .blocks-remove {
      align-self: flex-end;
      background: none;
      border: 1px solid var(--val-color-error);
      border-radius: var(--val-radius-md);
      padding: 0.25rem 0.5rem;
      color: var(--val-color-error);
      font-size: var(--val-text-xs);
      cursor: pointer;
    }
    .blocks-remove:hover {
      background: var(--val-color-error);
      color: oklch(1 0 0);
    }
    .blocks-add {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .blocks-type-select {
      background: var(--val-color-bg-muted);
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-md);
      padding: 0.375rem 0.75rem;
      color: var(--val-color-text);
      font-size: var(--val-text-sm);
    }
    .blocks-add-btn {
      background: var(--val-color-bg-muted);
      border: 1px dashed var(--val-color-border);
      border-radius: var(--val-radius-md);
      padding: 0.375rem 0.75rem;
      color: var(--val-color-text-muted);
      font-size: var(--val-text-sm);
      cursor: pointer;
    }
    .blocks-add-btn:hover {
      border-color: var(--val-blue-500);
      color: var(--val-color-text);
    }

    /* --- Edit meta + revisions --- */
    .edit-meta {
      margin-top: 1rem;
      padding-top: 0.75rem;
    }
    .diff-table .diff-changed td {
      background: oklch(0.3 0.05 80 / 0.3);
    }
    /* --- Media upload / drop zone --- */
    .media-drop-zone {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .media-preview {
      font-size: var(--val-text-sm);
      color: var(--val-color-text-muted);
    }
    .media-preview img {
      max-width: 200px;
      max-height: 150px;
      border-radius: var(--val-radius-md);
      border: 1px solid var(--val-color-border);
    }
    .drop-zone-text {
      font-size: var(--val-text-sm);
      color: var(--val-color-text-muted);
      text-align: center;
      padding: 1rem;
    }
    .focal-point-selector {
      position: relative;
      display: inline-block;
      cursor: crosshair;
    }
    .focal-point-image {
      max-width: 400px;
      max-height: 300px;
      border-radius: var(--val-radius-md);
      border: 1px solid var(--val-color-border);
    }
    .focal-point-marker {
      position: absolute;
      width: 20px;
      height: 20px;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .variant-thumbnails {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
    .variant-thumb {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }
    .variant-thumb img {
      border-radius: var(--val-radius-sm);
      border: 1px solid var(--val-color-border);
    }
    .variant-label {
      font-size: var(--val-text-xs);
      color: var(--val-color-text-muted);
    }
    /* --- Edit page container --- */
    .edit-container {
      max-width: 640px;
    }
    .edit-danger-zone {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--val-color-border);
    }
    .btn-ghost-danger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.375rem 0.75rem;
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      font-family: var(--val-font-sans);
      border-radius: var(--val-radius-md);
      border: 1px solid var(--val-color-error);
      background: transparent;
      color: var(--val-color-error);
      cursor: pointer;
      transition: background var(--val-duration-fast) var(--val-ease-in-out);
    }
    .btn-ghost-danger:hover {
      background: var(--val-color-error);
      color: oklch(1 0 0);
    }

    /* --- List view actions --- */
    .actions-cell {
      white-space: nowrap;
    }
    .action-link {
      font-size: var(--val-text-xs);
      padding: 0.25rem 0.5rem;
      border-radius: var(--val-radius-sm);
      color: var(--val-color-text-muted);
    }
    .action-link:hover {
      background: var(--val-color-bg-muted);
      color: var(--val-color-text);
    }

    /* --- Responsive --- */
    @media (max-width: 768px) {
      body { flex-direction: column; }
      .sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--val-color-border);
        padding: 1rem;
      }
      .sidebar ul { flex-direction: row; flex-wrap: wrap; gap: 0.5rem; }
      .main { padding: 1.5rem 1rem; }
    }
  </style>
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
