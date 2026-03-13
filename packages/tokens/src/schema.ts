import { z } from 'zod'
import { ok, err } from '@inertia/neverthrow'
import type { Result } from '@inertia/neverthrow'
import { TokenErrorCode } from './token-types.js'
import type { ThemeConfig, PartialTheme, TokenError } from './token-types.js'

const colorSetSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  card: z.string(),
  'card-foreground': z.string(),
  popover: z.string(),
  'popover-foreground': z.string(),
  primary: z.string(),
  'primary-foreground': z.string(),
  secondary: z.string(),
  'secondary-foreground': z.string(),
  muted: z.string(),
  'muted-foreground': z.string(),
  accent: z.string(),
  'accent-foreground': z.string(),
  destructive: z.string(),
  'destructive-foreground': z.string(),
  border: z.string(),
  input: z.string(),
  ring: z.string(),
  overlay: z.string(),
  'chart-1': z.string(),
  'chart-2': z.string(),
  'chart-3': z.string(),
  'chart-4': z.string(),
  'chart-5': z.string(),
  sidebar: z.string(),
  'sidebar-foreground': z.string(),
  'sidebar-primary': z.string(),
  'sidebar-primary-foreground': z.string(),
  'sidebar-accent': z.string(),
  'sidebar-accent-foreground': z.string(),
  'sidebar-border': z.string(),
  'sidebar-ring': z.string()
})

const shadowSetSchema = z.object({
  '2xs': z.string(),
  xs: z.string(),
  sm: z.string(),
  DEFAULT: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string()
})

const themeConfigSchema = z.object({
  colors: z.object({
    light: colorSetSchema,
    dark: colorSetSchema
  }),
  fonts: z.object({
    sans: z.string(),
    serif: z.string(),
    mono: z.string()
  }),
  radius: z.string(),
  spacing: z.string(),
  shadows: shadowSetSchema,
  tracking: z.string()
})

const partialColorSetSchema = colorSetSchema.partial()

const partialThemeSchema = z.object({
  colors: z.object({
    light: partialColorSetSchema,
    dark: partialColorSetSchema
  }).partial().optional(),
  fonts: z.object({
    sans: z.string(),
    serif: z.string(),
    mono: z.string()
  }).partial().optional(),
  radius: z.string().optional(),
  spacing: z.string().optional(),
  shadows: shadowSetSchema.partial().optional(),
  tracking: z.string().optional()
}).partial()

export function parseTheme (input: unknown): Result<ThemeConfig, TokenError> {
  const parsed = themeConfigSchema.safeParse(input)

  if (parsed.success) {
    return ok(parsed.data as ThemeConfig)
  }

  return err({
    code: TokenErrorCode.INVALID_SCHEMA,
    message: `Theme validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`
  })
}

export function parsePartialTheme (input: unknown): Result<PartialTheme, TokenError> {
  const parsed = partialThemeSchema.safeParse(input)

  if (parsed.success) {
    return ok(parsed.data as PartialTheme)
  }

  return err({
    code: TokenErrorCode.INVALID_SCHEMA,
    message: `Partial theme validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`
  })
}
