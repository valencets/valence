const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

const ESCAPE_REGEX = /[&<>"']/g

function escapeHtml (value: string): string {
  return value.replace(ESCAPE_REGEX, (ch) => ESCAPE_MAP[ch] ?? ch)
}

export function html (strings: TemplateStringsArray, ...values: ReadonlyArray<string | number | null | undefined>): string {
  let result = ''
  for (let i = 0; i < strings.length; i++) {
    result += strings[i]
    if (i < values.length) {
      const val = values[i]
      if (val === null || val === undefined) {
        continue
      }
      if (typeof val === 'number') {
        result += String(val)
      } else {
        result += escapeHtml(val)
      }
    }
  }
  return result
}

export interface LayoutConfig {
  readonly title: string
  readonly content: string
  readonly head?: string | undefined
  readonly nav?: string | undefined
  readonly footer?: string | undefined
  readonly lang?: string | undefined
  readonly fragment?: boolean | undefined
}

export function renderLayout (config: LayoutConfig): string {
  const lang = config.lang ?? 'en'

  if (config.fragment === true) {
    return config.content
  }

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(config.title)}</title>
${config.head ?? ''}
</head>
<body>
${config.nav ?? ''}
<main>
${config.content}
</main>
${config.footer ?? ''}
</body>
</html>`
}
