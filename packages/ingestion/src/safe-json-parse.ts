import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'

export interface ParseFailure {
  readonly code: 'PARSE_FAILURE'
  readonly message: string
  readonly raw: string
}

export function safeJsonParse (raw: string): Result<unknown, ParseFailure> {
  try {
    return ok(JSON.parse(raw))
  } catch (e: unknown) {
    const message = e instanceof SyntaxError
      ? e.message
      : 'Unknown parse error'

    return err({
      code: 'PARSE_FAILURE',
      message,
      raw
    })
  }
}
