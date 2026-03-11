// Token error codes — const union pattern (same as TelemetryErrorCode)
export const TokenErrorCode = {
  INVALID_SCHEMA: 'INVALID_SCHEMA'
} as const

export type TokenErrorCode = typeof TokenErrorCode[keyof typeof TokenErrorCode]

export interface TokenError {
  readonly code: TokenErrorCode
  readonly message: string
}

// ColorSet — all 38 semantic color tokens (light + dark)
export interface ColorSet {
  readonly background: string
  readonly foreground: string
  readonly card: string
  readonly 'card-foreground': string
  readonly popover: string
  readonly 'popover-foreground': string
  readonly primary: string
  readonly 'primary-foreground': string
  readonly secondary: string
  readonly 'secondary-foreground': string
  readonly muted: string
  readonly 'muted-foreground': string
  readonly accent: string
  readonly 'accent-foreground': string
  readonly destructive: string
  readonly 'destructive-foreground': string
  readonly border: string
  readonly input: string
  readonly ring: string
  readonly overlay: string
  readonly 'chart-1': string
  readonly 'chart-2': string
  readonly 'chart-3': string
  readonly 'chart-4': string
  readonly 'chart-5': string
  readonly sidebar: string
  readonly 'sidebar-foreground': string
  readonly 'sidebar-primary': string
  readonly 'sidebar-primary-foreground': string
  readonly 'sidebar-accent': string
  readonly 'sidebar-accent-foreground': string
  readonly 'sidebar-border': string
  readonly 'sidebar-ring': string
}

// ShadowSet — shadow-2xs through shadow-2xl
export interface ShadowSet {
  readonly '2xs': string
  readonly xs: string
  readonly sm: string
  readonly DEFAULT: string
  readonly md: string
  readonly lg: string
  readonly xl: string
  readonly '2xl': string
}

// ThemeConfig — full resolved configuration
export interface ThemeConfig {
  readonly colors: {
    readonly light: ColorSet
    readonly dark: ColorSet
  }
  readonly fonts: {
    readonly sans: string
    readonly serif: string
    readonly mono: string
  }
  readonly radius: string
  readonly spacing: string
  readonly shadows: ShadowSet
  readonly tracking: string
}

// DeepPartial utility — one level deeper than Partial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// PartialTheme — for client overrides
export type PartialTheme = DeepPartial<ThemeConfig>
