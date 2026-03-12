export const GLASS_BOX_CONFIG = {
  hoverDelayMs: 400,
  inspectorWidth: 320,
  stripHeight: 32,
  flushMessageDurationMs: 2000,
  overlayMarginPx: 24
} as const

export const OVERLAY_TYPE_COLORS: Record<string, string> = {
  CLICK: 'hsl(215, 60%, 55%)',
  SCROLL: 'hsl(280, 50%, 55%)',
  VIEWPORT_INTERSECT: 'hsl(180, 50%, 45%)',
  FORM_INPUT: 'hsl(45, 80%, 50%)',
  INTENT_NAVIGATE: 'hsl(150, 50%, 45%)',
  INTENT_CALL: 'hsl(340, 60%, 55%)',
  INTENT_BOOK: 'hsl(25, 70%, 50%)',
  INTENT_LEAD: 'hsl(100, 50%, 45%)'
}

export const EXPLAINER_MAP: Record<string, string> = {
  CLICK: 'This click event is captured by a single event listener on the document body. No individual click handlers — just data attributes.',
  SCROLL: 'Scroll depth is tracked via IntersectionObserver. No scroll listeners burning CPU.',
  VIEWPORT_INTERSECT: 'This element was observed entering the viewport. We track what visitors actually see.',
  FORM_INPUT: 'Form interaction captured. We track engagement, not the content you type.',
  INTENT_NAVIGATE: 'Navigation intent detected. We know where visitors want to go before they get there.',
  INTENT_CALL: 'Call intent tracked. This helps measure offline conversions from your website.',
  INTENT_BOOK: 'Booking intent captured. Conversion tracking without third-party scripts.',
  INTENT_LEAD: 'Lead intent captured. Tracks high-value conversion signals from form submissions.'
}
