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
    :root {
      --val-gray-50: oklch(0.9846 0.0017 247.84);
      --val-gray-200: oklch(0.9276 0.0058 264.53);
      --val-gray-400: oklch(0.7137 0.0192 261.32);
      --val-gray-700: oklch(0.3729 0.0306 259.73);
      --val-gray-800: oklch(0.2781 0.0296 256.85);
      --val-gray-900: oklch(0.2101 0.0318 264.66);
      --val-gray-950: oklch(0.1296 0.0274 261.69);
      --val-blue-400: oklch(0.7137 0.1434 254.62);
      --val-blue-500: oklch(0.6231 0.1880 259.81);
      --val-blue-600: oklch(0.5461 0.2152 262.88);
      --val-blue-700: oklch(0.4882 0.2172 264.38);
      --val-red-500: oklch(0.6368 0.2078 25.33);
      --val-font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --val-text-sm: 0.875rem;
      --val-text-base: 1rem;
      --val-text-xl: 1.25rem;
      --val-leading-normal: 1.5;
      --val-weight-medium: 500;
      --val-weight-semibold: 600;
      --val-weight-bold: 700;
      --val-radius-md: 0.375rem;
      --val-radius-lg: 0.5rem;
      --val-shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
      --val-duration-fast: 100ms;
      --val-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--val-font-sans);
      font-size: var(--val-text-base);
      line-height: var(--val-leading-normal);
      color: var(--val-gray-50);
      background: var(--val-gray-950);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      background: var(--val-gray-900);
      border: 1px solid var(--val-gray-700);
      border-radius: var(--val-radius-lg);
      padding: 2rem;
      box-shadow: var(--val-shadow-md);
    }
    .login-brand {
      font-size: var(--val-text-xl);
      font-weight: var(--val-weight-bold);
      text-align: center;
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }
    .login-brand span { color: var(--val-blue-400); }
    .login-error {
      background: oklch(0.6368 0.2078 25.33 / 0.15);
      border: 1px solid var(--val-red-500);
      color: var(--val-red-500);
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
      color: var(--val-gray-400);
    }
    .form-field input {
      background: var(--val-gray-800);
      border: 1px solid var(--val-gray-700);
      border-radius: var(--val-radius-md);
      padding: 0.5rem 0.75rem;
      color: var(--val-gray-50);
      font-family: var(--val-font-sans);
      font-size: var(--val-text-sm);
      transition: border-color var(--val-duration-fast) var(--val-ease-in-out),
                  box-shadow var(--val-duration-fast) var(--val-ease-in-out);
    }
    .form-field input:focus {
      outline: none;
      border-color: var(--val-blue-500);
      box-shadow: 0 0 0 2px var(--val-gray-950), 0 0 0 4px var(--val-blue-500);
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
      background: var(--val-blue-600);
      color: oklch(1 0 0);
      transition: background var(--val-duration-fast) var(--val-ease-in-out);
    }
    .btn-login:hover { background: var(--val-blue-700); }
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
