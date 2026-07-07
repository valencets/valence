import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  TransitionPreset,
  injectTransitionCSS,
  getTransitionPreset,
  TRANSITION_PRESETS
} from '../transition-presets.js'

function removeInjectedStyles (): void {
  document.querySelectorAll('style[data-val-transition]').forEach(el => el.remove())
}

describe('TRANSITION_PRESETS', () => {
  it('contains all expected preset keys', () => {
    expect(Object.keys(TRANSITION_PRESETS)).toEqual(
      expect.arrayContaining(['fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'none'])
    )
  })

  it('fade preset CSS contains opacity', () => {
    expect(TRANSITION_PRESETS.fade).toContain('opacity')
  })

  it('slide-left preset CSS contains translateX', () => {
    expect(TRANSITION_PRESETS['slide-left']).toContain('translateX')
  })

  it('slide-right preset CSS contains translateX', () => {
    expect(TRANSITION_PRESETS['slide-right']).toContain('translateX')
  })

  it('slide-up preset CSS contains translateY', () => {
    expect(TRANSITION_PRESETS['slide-up']).toContain('translateY')
  })

  it('slide-down preset CSS contains translateY', () => {
    expect(TRANSITION_PRESETS['slide-down']).toContain('translateY')
  })

  it('none preset is empty string or contains no animation', () => {
    // 'none' preset means no CSS injected / no-op
    expect(typeof TRANSITION_PRESETS.none).toBe('string')
  })
})

describe('TransitionPreset const union', () => {
  it('has expected values', () => {
    expect(TransitionPreset.fade).toBe('fade')
    expect(TransitionPreset['slide-left']).toBe('slide-left')
    expect(TransitionPreset['slide-right']).toBe('slide-right')
    expect(TransitionPreset['slide-up']).toBe('slide-up')
    expect(TransitionPreset['slide-down']).toBe('slide-down')
    expect(TransitionPreset.none).toBe('none')
  })

  it('is frozen and cannot be mutated', () => {
    expect(Object.isFrozen(TransitionPreset)).toBe(true)
  })
})

describe('injectTransitionCSS', () => {
  beforeEach(() => {
    removeInjectedStyles()
  })

  afterEach(() => {
    removeInjectedStyles()
  })

  it('injects a <style> element into <head> for fade preset', () => {
    injectTransitionCSS('fade')

    const style = document.querySelector('style[data-val-transition="fade"]')
    expect(style).not.toBeNull()
  })

  it('is idempotent — calling twice only injects one style element', () => {
    injectTransitionCSS('fade')
    injectTransitionCSS('fade')

    const styles = document.querySelectorAll('style[data-val-transition="fade"]')
    expect(styles.length).toBe(1)
  })

  it('injects separate styles for different presets', () => {
    injectTransitionCSS('fade')
    injectTransitionCSS('slide-left')

    expect(document.querySelector('style[data-val-transition="fade"]')).not.toBeNull()
    expect(document.querySelector('style[data-val-transition="slide-left"]')).not.toBeNull()
  })

  it('does nothing for "none" preset', () => {
    injectTransitionCSS('none')

    const style = document.querySelector('style[data-val-transition="none"]')
    expect(style).toBeNull()
  })

  it('does nothing for unknown preset name', () => {
    injectTransitionCSS('not-a-real-preset')

    const styles = document.querySelectorAll('style[data-val-transition]')
    expect(styles.length).toBe(0)
  })

  it('injected CSS contains @keyframes', () => {
    injectTransitionCSS('slide-right')

    const style = document.querySelector('style[data-val-transition="slide-right"]') as HTMLStyleElement | null
    expect(style?.textContent).toContain('@keyframes')
  })
})

describe('getTransitionPreset', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns null when element has no data-val-transition attribute', () => {
    const el = document.createElement('a')
    el.href = '/about'
    document.body.appendChild(el)

    expect(getTransitionPreset(el)).toBeNull()
  })

  it('returns preset name from data-val-transition attribute', () => {
    const el = document.createElement('a')
    el.href = '/about'
    el.setAttribute('data-val-transition', 'fade')
    document.body.appendChild(el)

    expect(getTransitionPreset(el)).toBe('fade')
  })

  it('returns any string value from the attribute', () => {
    const el = document.createElement('a')
    el.setAttribute('data-val-transition', 'slide-up')
    document.body.appendChild(el)

    expect(getTransitionPreset(el)).toBe('slide-up')
  })
})
