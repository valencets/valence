import type { ThemeConfig, PartialTheme } from './token-types.js'

export function resolveTheme (client: PartialTheme, base: ThemeConfig): ThemeConfig {
  return {
    colors: {
      light: { ...base.colors.light, ...client.colors?.light },
      dark: { ...base.colors.dark, ...client.colors?.dark }
    },
    fonts: { ...base.fonts, ...client.fonts },
    radius: client.radius ?? base.radius,
    spacing: client.spacing ?? base.spacing,
    shadows: { ...base.shadows, ...client.shadows },
    tracking: client.tracking ?? base.tracking
  }
}
