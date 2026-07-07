// CSS view transition presets injected on demand via data-val-transition attribute.
// Presets are CSS-only — no JS animation runtime required.

export const TransitionPreset = Object.freeze({
  fade: 'fade',
  'slide-left': 'slide-left',
  'slide-right': 'slide-right',
  'slide-up': 'slide-up',
  'slide-down': 'slide-down',
  none: 'none'
} as const)

export type TransitionPreset = typeof TransitionPreset[keyof typeof TransitionPreset]

// CSS keyframes string for each preset. 'none' is a no-op placeholder.
export const TRANSITION_PRESETS: Record<string, string> = {
  fade: `
@keyframes val-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes val-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
::view-transition-old(root) {
  animation: 200ms ease val-fade-out;
}
::view-transition-new(root) {
  animation: 200ms ease val-fade-in;
}
`.trim(),

  'slide-left': `
@keyframes val-slide-left-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}
@keyframes val-slide-left-out {
  from { transform: translateX(0); }
  to   { transform: translateX(-100%); }
}
::view-transition-old(root) {
  animation: 250ms ease val-slide-left-out;
}
::view-transition-new(root) {
  animation: 250ms ease val-slide-left-in;
}
`.trim(),

  'slide-right': `
@keyframes val-slide-right-in {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}
@keyframes val-slide-right-out {
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
}
::view-transition-old(root) {
  animation: 250ms ease val-slide-right-out;
}
::view-transition-new(root) {
  animation: 250ms ease val-slide-right-in;
}
`.trim(),

  'slide-up': `
@keyframes val-slide-up-in {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes val-slide-up-out {
  from { transform: translateY(0); }
  to   { transform: translateY(-100%); }
}
::view-transition-old(root) {
  animation: 250ms ease val-slide-up-out;
}
::view-transition-new(root) {
  animation: 250ms ease val-slide-up-in;
}
`.trim(),

  'slide-down': `
@keyframes val-slide-down-in {
  from { transform: translateY(-100%); }
  to   { transform: translateY(0); }
}
@keyframes val-slide-down-out {
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
}
::view-transition-old(root) {
  animation: 250ms ease val-slide-down-out;
}
::view-transition-new(root) {
  animation: 250ms ease val-slide-down-in;
}
`.trim(),

  none: ''
}

/**
 * Inject <style> for the named preset into <head>.
 * Idempotent — repeated calls for the same preset do nothing.
 * Does nothing for 'none' or unknown preset names.
 */
export function injectTransitionCSS (presetName: string): void {
  const css = TRANSITION_PRESETS[presetName]

  // 'none' preset or unknown preset — no injection
  if (css === undefined || css === '') return

  // Idempotent: skip if already injected
  if (document.querySelector(`style[data-val-transition="${presetName}"]`) !== null) return

  const style = document.createElement('style')
  style.setAttribute('data-val-transition', presetName)
  style.textContent = css
  document.head.appendChild(style)
}

/**
 * Read the data-val-transition attribute from an element.
 * Returns the preset name string or null if not present.
 */
export function getTransitionPreset (el: Element): string | null {
  return el.getAttribute('data-val-transition')
}
