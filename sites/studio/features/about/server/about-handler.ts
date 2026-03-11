import type { RouteHandler } from '../../../server/types.js'
import { isFragmentRequest, sendHtml } from '../../../server/router.js'
import { renderShell, renderFragment } from '../../../server/shell.js'
import { renderAbout } from '../templates/about.js'

export const aboutHandler: RouteHandler = async (req, res) => {
  const mainContent = renderAbout()

  if (isFragmentRequest(req)) {
    sendHtml(res, renderFragment(mainContent))
    return
  }

  const html = renderShell({
    title: 'About',
    description: 'Inertia Web Solutions — who we are, what we build, and why we deliver physical hardware.',
    criticalCSS: '',
    deferredCSSPath: '/css/studio.css',
    mainContent,
    currentPath: '/about'
  })
  sendHtml(res, html)
}
