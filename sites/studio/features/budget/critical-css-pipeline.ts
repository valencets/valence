import { extractCriticalCSS } from '@inertia/critical-css'
import type { SplitResult } from '@inertia/critical-css'
import { renderShell } from '../../server/shell.js'
import { renderHome } from '../home/templates/home.js'
import { renderPrinciples } from '../principles/templates/principles.js'
import { renderServices } from '../services/templates/services.js'
import { renderAbout } from '../about/templates/about.js'
import { renderContactForm } from '../contact/templates/contact.js'
import { getStudioCSS } from '../theme/config/studio-css.js'

interface CriticalCSSCache {
  getCriticalCSS: (route: string) => string | undefined
  getDeferredCSS: (route: string) => string | undefined
}

const PAGE_RENDERERS: Record<string, () => string> = {
  '/': renderHome,
  '/principles': renderPrinciples,
  '/services': renderServices,
  '/about': renderAbout,
  '/contact': () => renderContactForm()
}

export function createCriticalCSSPipeline (): CriticalCSSCache {
  const cache = new Map<string, SplitResult>()
  const fullCSS = getStudioCSS()

  for (const [route, render] of Object.entries(PAGE_RENDERERS)) {
    const content = render()
    const shell = renderShell({
      title: 'Inertia Studio',
      description: '',
      criticalCSS: '',
      deferredCSSPath: '/css/studio.css',
      mainContent: content,
      currentPath: route
    })
    const result = extractCriticalCSS(fullCSS, shell)

    if (result.isOk()) {
      cache.set(route, result.value)
    }
  }

  return {
    getCriticalCSS: (route: string) => cache.get(route)?.critical,
    getDeferredCSS: (route: string) => cache.get(route)?.deferred
  }
}
