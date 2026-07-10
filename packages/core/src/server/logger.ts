// Structured, dependency-free logging. One JSON object per line so log
// aggregators (Loki, CloudWatch, Datadog, `jq`) can parse server output
// without a third-party logger. The framework ethos: the platform is enough.

export const LogLevel = Object.freeze({
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
} as const)

export type LogLevel = typeof LogLevel[keyof typeof LogLevel]

// Numeric ranks drive threshold comparison without a switch (AV Rule 3).
const LEVEL_RANK: Readonly<Record<LogLevel, number>> = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
})

// Values are constrained to JSON scalars: no circular references means
// JSON.stringify cannot throw, so the emit path needs no exception handling.
export type LogFieldValue = string | number | boolean | null

export interface LogFields {
  readonly [key: string]: LogFieldValue | undefined
}

export type LogSink = (level: LogLevel, line: string) => void

export interface LoggerOptions {
  readonly level?: LogLevel
  readonly sink?: LogSink
  readonly base?: LogFields
  readonly now?: () => string
}

export interface Logger {
  readonly level: LogLevel
  readonly debug: (msg: string, fields?: LogFields) => void
  readonly info: (msg: string, fields?: LogFields) => void
  readonly warn: (msg: string, fields?: LogFields) => void
  readonly error: (msg: string, fields?: LogFields) => void
  readonly child: (bindings: LogFields) => Logger
}

const RESERVED_KEYS: ReadonlySet<string> = new Set(['level', 'time', 'msg'])

// Warnings and errors belong on stderr; observability streams and the
// human tailing `stdout` both stay readable when the two are separated.
function defaultSink (level: LogLevel, line: string): void {
  if (level === LogLevel.ERROR || level === LogLevel.WARN) {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

function formatLine (level: LogLevel, time: string, msg: string, fields: LogFields): string {
  const record: Record<string, LogFieldValue> = { level, time, msg }
  for (const [key, value] of Object.entries(fields)) {
    // Callers cannot overwrite the reserved envelope, and undefined fields
    // are dropped so the line stays clean.
    if (value !== undefined && !RESERVED_KEYS.has(key)) record[key] = value
  }
  return JSON.stringify(record)
}

export function createLogger (options?: LoggerOptions): Logger {
  const level = options?.level ?? LogLevel.INFO
  const sink = options?.sink ?? defaultSink
  const base = options?.base ?? {}
  const now = options?.now ?? (() => new Date().toISOString())
  const threshold = LEVEL_RANK[level]

  function emit (lvl: LogLevel, msg: string, fields?: LogFields): void {
    if (LEVEL_RANK[lvl] < threshold) return
    const merged: LogFields = fields ? { ...base, ...fields } : base
    sink(lvl, formatLine(lvl, now(), msg, merged))
  }

  return Object.freeze({
    level,
    debug: (msg: string, fields?: LogFields) => { emit(LogLevel.DEBUG, msg, fields) },
    info: (msg: string, fields?: LogFields) => { emit(LogLevel.INFO, msg, fields) },
    warn: (msg: string, fields?: LogFields) => { emit(LogLevel.WARN, msg, fields) },
    error: (msg: string, fields?: LogFields) => { emit(LogLevel.ERROR, msg, fields) },
    child: (bindings: LogFields) => createLogger({ level, sink, base: { ...base, ...bindings }, now })
  })
}

// Turn an operator-supplied string (env var, config) into a level, defaulting
// to `info` for anything unrecognized so a typo never silences the server.
export function parseLogLevel (value: string | undefined): LogLevel {
  const normalized = (value ?? '').toLowerCase()
  if (normalized === LogLevel.DEBUG) return LogLevel.DEBUG
  if (normalized === LogLevel.WARN) return LogLevel.WARN
  if (normalized === LogLevel.ERROR) return LogLevel.ERROR
  return LogLevel.INFO
}
