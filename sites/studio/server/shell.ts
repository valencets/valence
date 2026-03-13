// Boot timestamp for cache busting — changes each server restart
export const BOOT_VERSION = Date.now().toString(36)

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
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' }
]

const NAV_CTA = { href: '/free-site-audit', label: 'Free Site Audit' } as const

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
        <button class="nav-hamburger" aria-label="Toggle menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <div class="nav-links">
          ${links}
          <a href="${NAV_CTA.href}" class="btn btn-primary nav-cta" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="nav-${NAV_CTA.label.toLowerCase().replace(/\s+/g, '-')}">${NAV_CTA.label}</a>
        </div>
      </div>
    </nav>`
}

const DFW_SERVICE_AREA = [
  'McKinney', 'Dallas', 'Fort Worth', 'Plano', 'Frisco',
  'Allen', 'Richardson', 'Arlington', 'Denton', 'Prosper'
]

function renderLocalBusinessJsonLd (): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Inertia Web Solutions',
    url: 'https://inertiawebsolutions.com',
    telephone: '+1-972-815-7910',
    email: 'mail@forrestblade.com',
    description: 'Web studio building deterministic websites on dedicated server appliances you own. Based in McKinney, serving businesses across Dallas-Fort Worth.',
    priceRange: '$3,500-$4,800',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'McKinney',
      addressRegion: 'TX',
      addressCountry: 'US'
    },
    areaServed: DFW_SERVICE_AREA.map(city => ({
      '@type': 'City',
      name: city,
      containedInPlace: {
        '@type': 'State',
        name: 'Texas'
      }
    })),
    founder: {
      '@type': 'Person',
      name: 'Forrest Blade'
    },
    sameAs: [
      'https://github.com/forrestblade/inertia'
    ]
  }
  return `\n  <script type="application/ld+json">${JSON.stringify(data)}</script>`
}

export function renderShell (options: ShellOptions): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark" data-inertia-version="${BOOT_VERSION}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${options.title} | Inertia Web Solutions</title>
  <meta name="description" content="${options.description}">
  <meta name="geo.region" content="US-TX">
  <meta name="geo.placename" content="McKinney">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_US">
  <meta property="og:site_name" content="Inertia Web Solutions">
  <meta property="og:title" content="${options.title} | Inertia Web Solutions">
  <meta property="og:description" content="${options.description}">
  <meta property="og:image" content="https://inertiawebsolutions.com/img/og-card.png">
  <meta property="og:url" content="https://inertiawebsolutions.com${options.currentPath}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${options.title} | Inertia Web Solutions">
  <meta name="twitter:description" content="${options.description}">
  <meta name="twitter:image" content="https://inertiawebsolutions.com/img/og-card.png">
  <link rel="canonical" href="https://inertiawebsolutions.com${options.currentPath}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">${options.currentPath === '/' ? renderLocalBusinessJsonLd() : ''}
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
      <p>&copy; ${new Date().getFullYear()} Inertia Web Solutions. McKinney, TX. Serving the Dallas-Fort Worth metroplex.</p>
      <p class="footer-hardware">Served from a dedicated server appliance — your website can too. <a href="https://github.com/forrestblade/inertia" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="footer-github">View source on GitHub</a></p>
    </div>
  </footer>
  <script src="/js/boot.js?v=${BOOT_VERSION}" defer></script>
  <inertia-buffer-strip hardware-label="PI5"></inertia-buffer-strip>
  <inertia-telemetry-infobox></inertia-telemetry-infobox>
  <inertia-cache-indicator data-inertia-persist id="cache-indicator"></inertia-cache-indicator>
</body>
</html>`
}

export function renderFragment (mainContent: string): string {
  return mainContent
}
