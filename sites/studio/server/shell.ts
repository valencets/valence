// Boot timestamp for cache busting — changes each server restart
const BOOT_VERSION = Date.now().toString(36)

export interface ShellOptions {
  readonly title: string
  readonly description: string
  readonly criticalCSS: string
  readonly deferredCSSPath: string
  readonly mainContent: string
  readonly currentPath: string
}

const NAV_LINKS: ReadonlyArray<{ readonly href: string; readonly label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/principles', label: 'Principles' },
  { href: '/services', label: 'Services' },
  { href: '/audit', label: 'Audit' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
]

function renderNav (currentPath: string): string {
  const links = NAV_LINKS.map((link) => {
    const active = link.href === currentPath ? ' aria-current="page" class="nav-active"' : ''
    return `<a href="${link.href}" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="nav-${link.label.toLowerCase()}"${active}>${link.label}</a>`
  }).join('\n        ')

  return `<nav aria-label="Main navigation">
      <div class="nav-inner">
        <a href="/" class="nav-brand" aria-label="Inertia Web Solutions home">
          <img src="/img/mark-light.svg" alt="" width="24" height="24" class="nav-mark">
          INERTIA
        </a>
        ${links}
      </div>
    </nav>`
}

export function renderShell (options: ShellOptions): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${options.title} | Inertia Web Solutions</title>
  <meta name="description" content="${options.description}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>${options.criticalCSS}</style>
  <link rel="stylesheet" href="${options.deferredCSSPath}?v=${BOOT_VERSION}">
</head>
<body>
  <header>
    ${renderNav(options.currentPath)}
  </header>
  <main id="main-content">
    ${options.mainContent}
  </main>
  <footer>
    <div class="footer-inner">
      <p>&copy; ${new Date().getFullYear()} Inertia Web Solutions. All rights reserved.</p>
      <p class="footer-hardware">Served from a Raspberry Pi 5 — your website can too.</p>
    </div>
  </footer>

</body>
</html>`
}

export function renderFragment (mainContent: string): string {
  return mainContent
}
