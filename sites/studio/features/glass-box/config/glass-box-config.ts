export const GLASS_BOX_CONFIG = {
  hoverDelayMs: 400,
  inspectorWidth: 320,
  stripHeight: 32,
  flushMessageDurationMs: 2000
} as const

export const EXPLAINER_MAP: Record<string, string> = {
  CLICK: 'This click event is captured by a single event listener on the document body. No individual click handlers — just data attributes.',
  SCROLL: 'Scroll depth is tracked via IntersectionObserver. No scroll listeners burning CPU.',
  VIEWPORT_INTERSECT: 'This element was observed entering the viewport. We track what visitors actually see.',
  FORM_INPUT: 'Form interaction captured. We track engagement, not the content you type.',
  INTENT_NAVIGATE: 'Navigation intent detected. We know where visitors want to go before they get there.',
  INTENT_CALL: 'Call intent tracked. This helps measure offline conversions from your website.',
  INTENT_BOOK: 'Booking intent captured. Conversion tracking without third-party scripts.'
}
