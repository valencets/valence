import { PAGE_TOKEN_CSS } from './page-tokens.js'

export function landingPage (port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Valence</title>
  <style>
    ${PAGE_TOKEN_CSS}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: var(--val-font-sans); background: var(--val-color-bg); color: var(--val-color-text); display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .container { text-align: center; max-width: 480px; }
    h1 { font-size: var(--val-text-5xl); font-weight: 300; letter-spacing: 0.1em; margin-bottom: var(--val-space-4); }
    h1 span { font-weight: 600; color: var(--val-color-primary); }
    p { color: var(--val-color-text-muted); line-height: 1.6; margin-bottom: var(--val-space-8); }
    .links { display: flex; gap: var(--val-space-4); justify-content: center; }
    a { color: var(--val-color-primary); text-decoration: none; padding: var(--val-space-2) var(--val-space-4); border: 1px solid var(--val-color-primary); border-radius: var(--val-radius-md); transition: all var(--val-duration-fast); }
    a:hover { background: var(--val-color-primary); color: var(--val-color-bg); }
    code { background: var(--val-color-bg-elevated); padding: var(--val-space-1) var(--val-space-2); border-radius: var(--val-radius-sm); font-size: var(--val-text-sm); }
  </style>
</head>
<body>
  <div class="container">
    <svg viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="280" style="margin-bottom: var(--val-space-4);">
      <defs>
        <linearGradient id="orbital" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color: var(--val-color-primary-hover); stop-opacity: 0"/>
          <stop offset="40%" style="stop-color: var(--val-color-primary-hover); stop-opacity: 0.25"/>
          <stop offset="100%" style="stop-color: var(--val-color-primary-hover); stop-opacity: 0.7"/>
        </linearGradient>
      </defs>
      <ellipse cx="180" cy="40" rx="172" ry="32" stroke="url(#orbital)" stroke-width="1.5" fill="none" transform="rotate(-5, 180, 40)"/>
      <circle cx="350" cy="28" r="4" style="fill: var(--val-color-primary-hover)">
        <animateMotion dur="4s" repeatCount="indefinite" path="M0,0 A172,32 -5 1 1 -340,24 A172,32 -5 1 1 0,0" />
      </circle>
      <text x="180" y="44" text-anchor="middle" font-family="system-ui, sans-serif" font-size="46" letter-spacing="0.1em" style="fill: var(--val-color-text)">
        <tspan font-weight="600" style="fill: var(--val-color-primary-hover)">v</tspan><tspan font-weight="300">alence</tspan>
      </text>
    </svg>
    <p>Your site is running on port ${port}. Edit <code>valence.config.ts</code> to add collections, then visit the admin panel to create content.</p>
    <div class="links">
      <a href="/admin">Admin Panel</a>
      <a href="https://github.com/valencets/valence/wiki">Documentation</a>
    </div>
  </div>
</body>
</html>`
}
