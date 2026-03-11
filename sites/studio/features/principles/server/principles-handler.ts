import type { RouteHandler } from '../../../server/types.js'
import { isFragmentRequest, sendHtml } from '../../../server/router.js'
import { renderShell, renderFragment } from '../../../server/shell.js'
import { renderPrinciples } from '../templates/principles.js'

export const principlesHandler: RouteHandler = async (req, res) => {
  const mainContent = renderPrinciples()

  if (isFragmentRequest(req)) {
    sendHtml(res, renderFragment(mainContent))
    return
  }

  const html = renderShell({
    title: 'Principles',
    description: 'The four engineering principles behind Inertia — borrowed from aerospace, applied to web development.',
    criticalCSS: '',
    deferredCSSPath: '/css/studio.css',
    mainContent,
    currentPath: '/principles'
  })
  sendHtml(res, html)
}
