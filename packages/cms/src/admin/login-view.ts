import { escapeHtml } from './escape.js'

interface LoginPageArgs {
  readonly error?: string | undefined
  readonly csrfToken: string
}

export function renderLoginPage (args: LoginPageArgs): string {
  const errorHtml = args.error
    ? `<div class="login-error">${escapeHtml(args.error)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign In -- Valence CMS</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    :root {
      --val-font-sans: 'Inter', system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --val-text-sm: 0.875rem;
      --val-text-base: 1rem;
      --val-text-lg: 1.125rem;
      --val-text-xl: 1.25rem;
      --val-leading-normal: 1.5;
      --val-weight-medium: 500;
      --val-weight-semibold: 600;
      --val-weight-bold: 700;
      --val-radius-md: 8px;
      --val-radius-lg: 12px;
      --val-shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
      --val-duration-fast: 100ms;
      --val-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
      --val-red-500: oklch(0.6368 0.2078 25.33);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--val-font-sans);
      font-size: var(--val-text-base);
      line-height: var(--val-leading-normal);
      color: #e5e2e1;
      background: #131313;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      background: #1c1b1b;
      border: none;
      border-radius: var(--val-radius-lg);
      padding: 2.5rem 2rem;
      box-shadow: 0 8px 32px oklch(0 0 0 / 0.3);
      position: relative;
      overflow: hidden;
    }
    .login-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #45f99c, #00dc82);
    }
    .login-brand {
      font-size: var(--val-text-xl);
      font-weight: var(--val-weight-bold);
      text-align: center;
      margin-bottom: 2rem;
      letter-spacing: -0.03em;
      color: #e5e2e1;
    }
    .login-brand span { color: #45f99c; }
    .login-error {
      background: rgba(147, 0, 10, 0.3);
      border-left: 3px solid #ffb4ab;
      color: #ffb4ab;
      padding: 0.625rem 0.75rem;
      border-radius: var(--val-radius-md);
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      margin-bottom: 1rem;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin-bottom: 1rem;
    }
    .form-field label {
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      color: #9a9a9a;
    }
    .form-field input {
      background: #353534;
      border: 1px solid rgba(60, 74, 63, 0.25);
      border-radius: var(--val-radius-md);
      padding: 0.625rem 0.875rem;
      color: #e5e2e1;
      font-family: var(--val-font-sans);
      font-size: var(--val-text-sm);
      transition: border-color var(--val-duration-fast) var(--val-ease-in-out),
                  box-shadow var(--val-duration-fast) var(--val-ease-in-out);
    }
    .form-field input:focus {
      outline: none;
      border-color: #45f99c;
      box-shadow: 0 0 0 3px rgba(69, 249, 156, 0.15);
    }
    .btn-login {
      width: 100%;
      padding: 0.625rem 1rem;
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-semibold);
      font-family: var(--val-font-sans);
      border-radius: var(--val-radius-md);
      border: none;
      cursor: pointer;
      background: linear-gradient(135deg, #45f99c, #00dc82);
      color: #003920;
      transition: background var(--val-duration-fast) var(--val-ease-in-out),
                  box-shadow var(--val-duration-fast) var(--val-ease-in-out);
      margin-top: 0.5rem;
    }
    .btn-login:hover {
      background: linear-gradient(135deg, #00dc82, #00c476);
      box-shadow: 0 0 20px rgba(69, 249, 156, 0.25);
    }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="login-brand"><span>v</span>alence</div>
    ${errorHtml}
    <form method="POST" action="/admin/login">
      <input type="hidden" name="_csrf" value="${escapeHtml(args.csrfToken)}">
      <div class="form-field">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autocomplete="email" autofocus>
      </div>
      <div class="form-field">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="current-password">
      </div>
      <button type="submit" class="btn-login">Sign in</button>
    </form>
  </div>
</body>
</html>`
}
