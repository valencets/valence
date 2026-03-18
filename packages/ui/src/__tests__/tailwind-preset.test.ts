import { describe, it, expect } from 'vitest'
import { valencePreset } from '../tailwind/index.js'

describe('valencePreset', () => {
  it('is a valid Tailwind preset object', () => {
    expect(valencePreset).toBeDefined()
    expect(valencePreset.theme).toBeDefined()
    expect(valencePreset.theme.extend).toBeDefined()
  })

  describe('colors', () => {
    it('maps semantic color tokens', () => {
      const colors = valencePreset.theme.extend.colors
      expect(colors.val.bg).toBe('var(--val-color-bg)')
      expect(colors.val['bg-elevated']).toBe('var(--val-color-bg-elevated)')
      expect(colors.val['bg-muted']).toBe('var(--val-color-bg-muted)')
      expect(colors.val.text).toBe('var(--val-color-text)')
      expect(colors.val['text-muted']).toBe('var(--val-color-text-muted)')
      expect(colors.val.primary).toBe('var(--val-color-primary)')
      expect(colors.val['primary-hover']).toBe('var(--val-color-primary-hover)')
      expect(colors.val.error).toBe('var(--val-color-error)')
      expect(colors.val.success).toBe('var(--val-color-success)')
      expect(colors.val.warning).toBe('var(--val-color-warning)')
      expect(colors.val['text-inverted']).toBe('var(--val-color-text-inverted)')
      expect(colors.val['primary-text']).toBe('var(--val-color-primary-text)')
      expect(colors.val.border).toBe('var(--val-color-border)')
      expect(colors.val['border-focus']).toBe('var(--val-color-border-focus)')
    })

    it('maps gray primitive scale (50–950)', () => {
      const gray = valencePreset.theme.extend.colors['val-gray']
      expect(gray['50']).toBe('var(--val-gray-50)')
      expect(gray['500']).toBe('var(--val-gray-500)')
      expect(gray['950']).toBe('var(--val-gray-950)')
    })

    it('maps blue primitive scale (50–900)', () => {
      const blue = valencePreset.theme.extend.colors['val-blue']
      expect(blue['50']).toBe('var(--val-blue-50)')
      expect(blue['500']).toBe('var(--val-blue-500)')
      expect(blue['900']).toBe('var(--val-blue-900)')
    })

    it('maps red primitive scale (50–900)', () => {
      const red = valencePreset.theme.extend.colors['val-red']
      expect(red['50']).toBe('var(--val-red-50)')
      expect(red['900']).toBe('var(--val-red-900)')
    })

    it('maps green primitive scale (50–900)', () => {
      const green = valencePreset.theme.extend.colors['val-green']
      expect(green['50']).toBe('var(--val-green-50)')
      expect(green['900']).toBe('var(--val-green-900)')
    })

    it('maps amber primitive scale (50–900)', () => {
      const amber = valencePreset.theme.extend.colors['val-amber']
      expect(amber['50']).toBe('var(--val-amber-50)')
      expect(amber['900']).toBe('var(--val-amber-900)')
    })
  })

  describe('spacing', () => {
    it('maps spacing tokens (0–24)', () => {
      const spacing = valencePreset.theme.extend.spacing
      expect(spacing['val-0']).toBe('var(--val-space-0)')
      expect(spacing['val-1']).toBe('var(--val-space-1)')
      expect(spacing['val-4']).toBe('var(--val-space-4)')
      expect(spacing['val-8']).toBe('var(--val-space-8)')
      expect(spacing['val-24']).toBe('var(--val-space-24)')
    })
  })

  describe('borderRadius', () => {
    it('maps radius tokens', () => {
      const radius = valencePreset.theme.extend.borderRadius
      expect(radius['val-sm']).toBe('var(--val-radius-sm)')
      expect(radius['val-md']).toBe('var(--val-radius-md)')
      expect(radius['val-lg']).toBe('var(--val-radius-lg)')
      expect(radius['val-full']).toBe('var(--val-radius-full)')
    })
  })

  describe('fontSize', () => {
    it('maps type scale tokens', () => {
      const fontSize = valencePreset.theme.extend.fontSize
      expect(fontSize['val-xs']).toBe('var(--val-text-xs)')
      expect(fontSize['val-base']).toBe('var(--val-text-base)')
      expect(fontSize['val-5xl']).toBe('var(--val-text-5xl)')
    })
  })

  describe('fontFamily', () => {
    it('maps font family tokens', () => {
      const fontFamily = valencePreset.theme.extend.fontFamily
      expect(fontFamily['val-sans']).toBe('var(--val-font-sans)')
      expect(fontFamily['val-mono']).toBe('var(--val-font-mono)')
    })
  })

  describe('boxShadow', () => {
    it('maps shadow tokens', () => {
      const boxShadow = valencePreset.theme.extend.boxShadow
      expect(boxShadow['val-sm']).toBe('var(--val-shadow-sm)')
      expect(boxShadow['val-md']).toBe('var(--val-shadow-md)')
      expect(boxShadow['val-lg']).toBe('var(--val-shadow-lg)')
    })
  })

  describe('transitionDuration', () => {
    it('maps duration tokens', () => {
      const duration = valencePreset.theme.extend.transitionDuration
      expect(duration['val-fast']).toBe('var(--val-duration-fast)')
      expect(duration['val-normal']).toBe('var(--val-duration-normal)')
      expect(duration['val-slow']).toBe('var(--val-duration-slow)')
    })
  })

  describe('transitionTimingFunction', () => {
    it('maps easing tokens', () => {
      const easing = valencePreset.theme.extend.transitionTimingFunction
      expect(easing['val-in']).toBe('var(--val-ease-in)')
      expect(easing['val-out']).toBe('var(--val-ease-out)')
      expect(easing['val-in-out']).toBe('var(--val-ease-in-out)')
    })
  })
})
