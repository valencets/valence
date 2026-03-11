import { fromThrowable } from 'neverthrow'
import type { Result } from 'neverthrow'

export interface ParseFailure {
  readonly code: 'PARSE_FAILURE'
  readonly message: string
  readonly raw: string
}

const parseJson = fromThrowable(JSON.parse)

export function safeJsonParse (raw: string): Result<unknown, ParseFailure> {
  return parseJson(raw).mapErr((e: unknown): ParseFailure => ({
    code: 'PARSE_FAILURE',
    message: e instanceof SyntaxError ? e.message : 'Unknown parse error',
    raw
  }))
}
