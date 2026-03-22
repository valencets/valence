import { escapeHtml } from './escape.js'
import { getAdminStyles } from './admin-styles.js'
import { CSP_NONCE_PLACEHOLDER } from '@valencets/core/server'

interface LoginPageArgs {
  readonly error?: string | undefined
  readonly csrfToken: string
}

export function renderLoginPage (args: LoginPageArgs): string {
  const errorHtml = args.error
    ? `<div class="km-error">${escapeHtml(args.error)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign In \u2014 Valence CMS</title>
  <style nonce="${CSP_NONCE_PLACEHOLDER}">${getAdminStyles()}
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .login-brand {
      text-align: center;
      margin-bottom: 3rem;
    }
    .login-brand-icon {
      width: 2.5rem;
      height: 2.5rem;
      background: linear-gradient(135deg, oklch(0.90 0.19 159.5), oklch(0.80 0.19 159.5));
      border-radius: 0.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
    }
    .login-brand-icon svg { width: 1.25rem; height: 1.25rem; fill: #00391d; }
    .login-brand h1 {
      font-family: var(--km-font-headline);
      font-size: 1.875rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: var(--km-on-surface);
    }
    .login-brand p {
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--km-on-surface-variant);
      margin-top: 0.5rem;
    }
    .login-container {
      width: 100%;
      max-width: 420px;
      position: relative;
    }
    .login-container:hover .login-hover-glow { opacity: 1; }
    .login-hover-glow {
      position: absolute;
      inset: -1rem;
      background: oklch(0.28 0.03 256.85 / 0.2);
      filter: blur(48px);
      border-radius: 9999px;
      opacity: 0;
      transition: opacity 700ms;
      pointer-events: none;
    }
    .login-form-wrap { padding: 2rem; }
    @media (min-width: 768px) { .login-form-wrap { padding: 2.5rem; } }
    .login-form-wrap form { display: flex; flex-direction: column; gap: 1.5rem; }
    .login-field { display: flex; flex-direction: column; gap: 0.5rem; }
    /* val-input is styled via ThemeManager token sheets in shadow DOM */
    val-input { display: block; }
    val-input svg[slot="icon"] { pointer-events: none; }
    .login-submit { padding-top: 1rem; }
    .login-footer {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid oklch(0.37 0.03 259.73 / 0.1);
      text-align: center;
    }
    .login-footer p { font-size: 0.75rem; color: var(--km-on-surface-variant); }
    .login-footer a {
      color: var(--km-on-surface);
      font-weight: 600;
      text-decoration: none;
    }
    .login-footer a:hover { color: oklch(0.90 0.19 159.5); }
    .login-status {
      margin-top: 2rem;
      display: flex;
      justify-content: space-between;
      padding: 0 0.5rem;
      opacity: 0.5;
    }
    .login-status-item { display: flex; align-items: center; gap: 0.375rem; }
    .login-status-text {
      font-size: 0.625rem;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      color: var(--km-on-surface-variant);
    }
  </style>
</head>
<body>
  <div class="km-kinetic-bg"></div>
  <div class="km-glow km-glow-primary"></div>
  <div class="km-glow km-glow-tertiary"></div>

  <header class="login-brand">
    <div class="login-brand-icon">
      <svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>
    </div>
    <h1>Valence CMS</h1>
    <p>Admin Console Access</p>
  </header>

  <div class="login-container">
    <div class="login-hover-glow"></div>
    <div class="km-card">
      <div class="km-accent-line"></div>
      <div class="login-form-wrap">
        ${errorHtml}
        <form method="POST" action="/admin/login">
          <input type="hidden" name="_csrf" value="${escapeHtml(args.csrfToken)}">
          <div class="login-field">
            <val-input name="email" type="email" placeholder="admin@valence.io" required autocomplete="email" size="lg">
              <span slot="label" class="km-label">Email Address</span>
              <svg slot="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0V12a10 10 0 1 0-4 8"/></svg>
            </val-input>
          </div>
          <div class="login-field">
            <val-input name="password" type="password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" required autocomplete="current-password" size="lg">
              <span slot="label" class="km-label">Password</span>
              <svg slot="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </val-input>
          </div>
          <div class="login-submit">
            <val-button block type="submit" class="km-gradient-btn">Sign In \u2192</val-button>
          </div>
        </form>
        <div class="login-footer">
          <p>Don\u2019t have an account? <a href="#">Contact System Admin</a></p>
        </div>
      </div>
    </div>
    <div class="login-status">
      <div class="login-status-item">
        <span class="km-status-dot"></span>
        <span class="login-status-text">System Online</span>
      </div>
      <div class="login-status-item">
        <span class="login-status-text">Valence</span>
      </div>
    </div>
  </div>

  <script type="module" src="/admin/_assets/admin-client.js" nonce="${CSP_NONCE_PLACEHOLDER}"></script>
</body>
</html>`
}
