// Kinetic Monolith design system — admin stylesheet generator.
// Uses --val-* tokens from @valencets/ui with Kinetic Monolith overrides:
// tonal surface layering, green accent (#45f99c), no gratuitous borders.
// Inter font loaded from Google Fonts for body, JetBrains Mono for code.

/** Returns the full admin CSS stylesheet as a string. */
export function getAdminStyles (): string {
  return `/* --- Google Fonts --- */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    /* --- Primitive tokens (from @valencets/ui) --- */
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
      --val-font-sans: 'Inter', system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --val-font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
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
      --val-radius-sm: 6px;
      --val-radius-md: 8px;
      --val-radius-lg: 12px;
      --val-shadow-sm: 0 1px 2px 0 oklch(0 0 0 / 0.05);
      --val-shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
      --val-duration-fast: 100ms;
      --val-duration-normal: 200ms;
      --val-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* --- Kinetic Monolith semantic tokens (forced dark, green accent) --- */
    :root {
      /* Surface hierarchy (tonal layering) */
      --val-color-bg: #131313;
      --val-color-bg-elevated: #1c1b1b;
      --val-color-bg-muted: #201f1f;
      --val-color-bg-container: #2a2a2a;
      --val-color-bg-container-high: #353534;
      --val-color-bg-bright: #3a3939;

      /* Text */
      --val-color-text: #e5e2e1;
      --val-color-text-muted: #9a9a9a;

      /* Primary (green accent) */
      --val-color-primary: #45f99c;
      --val-color-primary-hover: #00dc82;
      --val-color-primary-text: #003920;
      --val-color-surface-tint: #1ce388;

      /* Outline / Border */
      --val-color-border: rgba(60, 74, 63, 0.25);
      --val-color-border-focus: #45f99c;
      --val-focus-ring: 0 0 0 2px #131313, 0 0 0 4px #45f99c;

      /* Feedback */
      --val-color-error: #ffb4ab;
      --val-color-error-container: #93000a;
      --val-color-success: #45f99c;
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
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    a { color: var(--val-color-primary); text-decoration: none; }
    a:hover { color: var(--val-color-primary-hover); }

    /* --- Admin Layout (grid: sidebar + main) --- */
    .admin-layout {
      display: grid;
      grid-template-columns: 260px 1fr;
      min-height: 100vh;
    }

    /* --- Sidebar --- */
    .admin-sidebar {
      background: var(--val-color-bg-elevated);
      padding: 0;
      display: flex;
      flex-direction: column;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }

    .sidebar-header {
      padding: 1.5rem 1.25rem 1rem;
    }

    .sidebar-brand {
      font-size: var(--val-text-lg);
      font-weight: var(--val-weight-bold);
      color: var(--val-color-primary);
      letter-spacing: -0.03em;
      margin: 0;
    }

    .sidebar-nav {
      flex: 1;
      padding: 0 0.75rem;
    }

    .sidebar-nav ul { list-style: none; display: flex; flex-direction: column; gap: 2px; }

    .nav-group-heading {
      font-size: var(--val-text-xs);
      font-weight: var(--val-weight-semibold);
      color: var(--val-color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 1rem 0.75rem 0.375rem;
      margin-top: 0.25rem;
    }

    .sidebar-nav a, .admin-sidebar a {
      display: block;
      padding: 0.5rem 0.75rem;
      border-radius: var(--val-radius-md);
      color: var(--val-color-text-muted);
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      transition: background var(--val-duration-fast) var(--val-ease-in-out),
                  color var(--val-duration-fast) var(--val-ease-in-out);
      border-left: 2px solid transparent;
    }
    .sidebar-nav a:hover, .admin-sidebar a:hover {
      background: var(--val-color-bg-muted);
      color: var(--val-color-text);
    }
    .sidebar-nav a.active {
      color: var(--val-color-primary);
      border-left-color: var(--val-color-primary);
      background: rgba(69, 249, 156, 0.06);
    }

    .sidebar-footer {
      padding: 0.75rem;
      margin-top: auto;
      border-top: 1px solid var(--val-color-border);
    }

    .sidebar-footer a {
      display: block;
      padding: 0.5rem 0.75rem;
      border-radius: var(--val-radius-md);
      color: var(--val-color-text-muted);
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      transition: background var(--val-duration-fast) var(--val-ease-in-out),
                  color var(--val-duration-fast) var(--val-ease-in-out);
    }
    .sidebar-footer a:hover {
      background: var(--val-color-bg-muted);
      color: var(--val-color-text);
    }

    .sidebar-logout-btn {
      display: block;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: var(--val-radius-md);
      color: var(--val-color-text-muted);
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
      font-family: var(--val-font-sans);
      transition: background var(--val-duration-fast) var(--val-ease-in-out),
                  color var(--val-duration-fast) var(--val-ease-in-out);
    }
    .sidebar-logout-btn:hover {
      background: var(--val-color-bg-muted);
      color: var(--val-color-text);
    }

    /* Legacy .sidebar class (keep for backward compat with tests) */
    .sidebar {
      width: 260px;
      flex-shrink: 0;
      background: var(--val-color-bg-elevated);
      padding: 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .sidebar-brand a { color: var(--val-color-primary); text-decoration: none; }

    .sidebar ul { list-style: none; display: flex; flex-direction: column; gap: 2px; }

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

    /* --- Main content --- */
    .admin-main, .main {
      flex: 1;
      padding: 2rem 2.5rem;
      min-width: 0;
      max-width: 100%;
      overflow-x: hidden;
    }

    .admin-main > h1, .main > h1 {
      font-size: var(--val-text-2xl);
      font-weight: var(--val-weight-bold);
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
      color: var(--val-color-text);
    }

    /* --- Dashboard cards --- */
    .dashboard { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }

    .card {
      background: var(--val-color-bg-elevated);
      border: none;
      border-left: 2px solid var(--val-color-primary);
      border-radius: var(--val-radius-lg);
      padding: 1.25rem;
      box-shadow: var(--val-shadow-sm);
      transition: background var(--val-duration-fast) var(--val-ease-in-out),
                  box-shadow var(--val-duration-fast) var(--val-ease-in-out);
    }
    .card:hover {
      background: var(--val-color-bg-muted);
      box-shadow: var(--val-shadow-md);
    }
    .card a { color: var(--val-color-text); text-decoration: none; display: block; }
    .card h3 {
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-semibold);
      color: var(--val-color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stat-count {
      font-size: var(--val-text-2xl);
      font-weight: var(--val-weight-bold);
      color: var(--val-color-text);
      margin-top: 0.25rem;
    }

    /* --- Stat cards with accent lines --- */
    .stat-card {
      background: var(--val-color-bg-elevated);
      border-left: 2px solid var(--val-color-primary);
      border-radius: var(--val-radius-lg);
      padding: 1.25rem 1.5rem;
    }

    /* --- Tables (no row borders, hover bg shift) --- */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--val-text-sm);
      margin-top: 1rem;
    }
    th {
      text-align: left;
      padding: 0.75rem 1rem;
      font-weight: var(--val-weight-semibold);
      color: var(--val-color-text-muted);
      font-size: var(--val-text-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--val-color-border);
    }
    td {
      padding: 0.75rem 1rem;
      border-bottom: none;
      color: var(--val-color-text);
    }
    tr { transition: background var(--val-duration-fast) var(--val-ease-in-out); }
    tr:hover td { background: var(--val-color-bg-bright); }

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
      background: var(--val-color-bg-container-high);
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-md);
      padding: 0.625rem 0.875rem;
      color: var(--val-color-text);
      font-family: var(--val-font-sans);
      font-size: var(--val-text-sm);
      transition: border-color var(--val-duration-fast) var(--val-ease-in-out),
                  box-shadow var(--val-duration-fast) var(--val-ease-in-out);
    }
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      outline: none;
      border-color: var(--val-color-primary);
      box-shadow: 0 0 0 3px rgba(69, 249, 156, 0.15);
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
      transition: background var(--val-duration-fast) var(--val-ease-in-out),
                  box-shadow var(--val-duration-fast) var(--val-ease-in-out);
    }
    .btn-primary {
      background: linear-gradient(135deg, #45f99c, #00dc82);
      color: var(--val-color-primary-text);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #00dc82, #00c476);
      color: var(--val-color-primary-text);
      box-shadow: 0 0 16px rgba(69, 249, 156, 0.2);
    }
    .btn-secondary {
      background: transparent;
      border: 1px solid var(--val-color-border);
      color: var(--val-color-text);
    }
    .btn-secondary:hover {
      background: var(--val-color-bg-muted);
    }
    .btn-danger {
      background: var(--val-color-error);
      color: #131313;
    }
    .btn-danger:hover {
      background: #ff9b8f;
      box-shadow: 0 0 12px rgba(255, 180, 171, 0.2);
    }

    .empty-state {
      color: var(--val-color-text-muted);
      padding: 3rem 0;
      text-align: center;
    }
    .empty-state a {
      color: var(--val-color-primary);
      font-weight: var(--val-weight-medium);
    }

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .list-search {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .list-filters {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-top: 0.75rem;
      flex-wrap: wrap;
    }
    .list-filter-label {
      font-size: var(--val-text-sm);
      color: var(--val-color-text-muted);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .filter-link {
      font-size: var(--val-text-sm);
      padding: 0.25rem 0.5rem;
      border-radius: var(--val-radius-sm);
      color: var(--val-color-text-muted);
    }
    .filter-link:hover {
      background: var(--val-color-bg-muted);
      color: var(--val-color-text);
    }
    .filter-active {
      color: var(--val-color-primary);
      background: rgba(69, 249, 156, 0.08);
    }

    /* --- Pagination --- */
    .pagination {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1.5rem;
      font-size: var(--val-text-sm);
    }
    .pagination-link {
      padding: 0.375rem 0.75rem;
      border-radius: var(--val-radius-md);
      color: var(--val-color-text-muted);
      transition: background var(--val-duration-fast) var(--val-ease-in-out);
    }
    a.pagination-link:hover {
      background: var(--val-color-bg-muted);
      color: var(--val-color-text);
    }
    span.pagination-link[aria-disabled="true"] {
      opacity: 0.4;
      cursor: default;
    }
    .pagination-info {
      color: var(--val-color-text-muted);
      padding: 0 0.5rem;
    }

    /* --- Status badges --- */
    .status-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: var(--val-radius-sm);
      font-size: var(--val-text-xs);
      font-weight: var(--val-weight-semibold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .status-draft {
      background: var(--val-color-bg-container);
      color: var(--val-color-text-muted);
    }
    .status-published {
      background: rgba(69, 249, 156, 0.12);
      color: var(--val-color-primary);
    }

    /* --- Toast --- */
    .toast {
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      border-radius: var(--val-radius-md);
      box-shadow: var(--val-shadow-md);
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      z-index: 1000;
      transition: opacity var(--val-duration-normal) var(--val-ease-in-out);
    }
    .toast-error {
      background: var(--val-color-error-container);
      color: var(--val-color-error);
      border-left: 3px solid var(--val-color-error);
    }
    .toast-success {
      background: rgba(69, 249, 156, 0.12);
      color: var(--val-color-primary);
      border-left: 3px solid var(--val-color-primary);
    }
    .toast-info {
      background: var(--val-color-bg-container);
      color: var(--val-color-text);
      border-left: 3px solid var(--val-blue-500);
    }
    .toast-dismiss {
      background: none;
      border: none;
      color: inherit;
      font-size: var(--val-text-lg);
      cursor: pointer;
      padding: 0;
      line-height: 1;
      opacity: 0.7;
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
      background: var(--val-color-bg-container);
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
      background: var(--val-color-bg-container-high);
      color: var(--val-color-text);
      font-family: var(--val-font-sans);
      font-size: var(--val-text-sm);
      line-height: var(--val-leading-normal);
      outline: none;
    }
    .ProseMirror:focus {
      box-shadow: inset 0 0 0 2px var(--val-color-primary);
    }
    .ProseMirror p { margin-bottom: 0.5rem; }
    .ProseMirror h2 { font-size: var(--val-text-xl); font-weight: var(--val-weight-bold); margin: 1rem 0 0.5rem; }
    .ProseMirror h3 { font-size: var(--val-text-lg); font-weight: var(--val-weight-semibold); margin: 0.75rem 0 0.5rem; }
    .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; margin-bottom: 0.5rem; }
    .ProseMirror blockquote {
      border-left: 3px solid var(--val-color-primary);
      padding-left: 0.75rem;
      color: var(--val-color-text-muted);
      margin: 0.5rem 0;
    }
    .ProseMirror a { color: var(--val-color-primary); text-decoration: underline; }
    .ProseMirror code {
      background: var(--val-color-bg-container);
      padding: 0.125rem 0.375rem;
      border-radius: var(--val-radius-sm);
      font-family: var(--val-font-mono);
      font-size: 0.85em;
    }
    .ProseMirror hr {
      border: none;
      border-top: 1px solid var(--val-color-border);
      margin: 1rem 0;
    }
    .ProseMirror pre {
      background: var(--val-color-bg-container);
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
      background: var(--val-color-bg-container-high);
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
      border-color: var(--val-color-primary);
      box-shadow: 0 0 0 3px rgba(69, 249, 156, 0.15);
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
      border-color: var(--val-color-primary);
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
      color: #131313;
    }
    .blocks-add {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .blocks-type-select {
      background: var(--val-color-bg-container-high);
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
      border-color: var(--val-color-primary);
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
    .edit-split-pane {
      max-width: none;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
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
      color: #131313;
    }

    /* --- Form actions (draft/publish buttons) --- */
    .form-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    /* --- Ghost editor layout --- */
    .ghost-layout {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 2rem;
      max-width: none;
    }
    .ghost-main {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .ghost-sidebar {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .content-title {
      font-size: var(--val-text-2xl);
      font-weight: var(--val-weight-bold);
      padding: 0.75rem 0;
      border: none;
      border-bottom: 1px solid var(--val-color-border);
      background: transparent;
      color: var(--val-color-text);
      letter-spacing: -0.01em;
    }
    .content-title:focus {
      outline: none;
      border-bottom-color: var(--val-color-primary);
    }

    /* --- Locale tabs --- */
    .locale-tabs {
      display: flex;
      gap: 0;
      margin-bottom: 1rem;
    }
    .locale-tab {
      padding: 0.5rem 1rem;
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      color: var(--val-color-text-muted);
      border-bottom: 2px solid transparent;
      transition: color var(--val-duration-fast) var(--val-ease-in-out);
    }
    .locale-tab:hover {
      color: var(--val-color-text);
    }
    .locale-tab-active {
      color: var(--val-color-primary);
      border-bottom-color: var(--val-color-primary);
    }
    .locale-selector {
      font-size: var(--val-text-sm);
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

    /* --- Grid view --- */
    .grid-view {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    .grid-card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: var(--val-radius-lg);
      transition: background var(--val-duration-fast) var(--val-ease-in-out);
      color: var(--val-color-text);
    }
    .grid-card:hover {
      background: var(--val-color-bg-muted);
    }
    .grid-thumb {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: var(--val-radius-md);
    }
    .grid-thumb-file {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--val-color-bg-container);
      color: var(--val-color-text-muted);
      font-size: var(--val-text-xs);
    }
    .grid-label {
      font-size: var(--val-text-sm);
      color: var(--val-color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* --- View toggle --- */
    .view-toggle {
      display: flex;
      border-radius: var(--val-radius-md);
      overflow: hidden;
      border: 1px solid var(--val-color-border);
    }
    .view-toggle-btn {
      padding: 0.375rem 0.75rem;
      font-size: var(--val-text-sm);
      color: var(--val-color-text-muted);
      transition: background var(--val-duration-fast) var(--val-ease-in-out);
    }
    .view-toggle-btn:hover {
      background: var(--val-color-bg-muted);
    }
    .view-toggle-active {
      background: var(--val-color-bg-container);
      color: var(--val-color-primary);
    }

    /* --- Bulk operations --- */
    val-bulk-bar {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem 0;
    }

    /* --- Responsive --- */
    @media (max-width: 768px) {
      body { flex-direction: column; }
      .admin-layout {
        grid-template-columns: 1fr;
      }
      .admin-sidebar {
        position: static;
        height: auto;
        border-bottom: 1px solid var(--val-color-border);
      }
      .sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--val-color-border);
        padding: 1rem;
      }
      .sidebar ul { flex-direction: row; flex-wrap: wrap; gap: 0.5rem; }
      .sidebar-nav ul { flex-direction: row; flex-wrap: wrap; gap: 0.5rem; }
      .admin-main, .main { padding: 1.5rem 1rem; }
      .ghost-layout {
        grid-template-columns: 1fr;
      }
      .edit-split-pane {
        grid-template-columns: 1fr;
      }
    }`
}
