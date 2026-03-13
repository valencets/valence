import type { IncomingMessage } from 'node:http'

export const PERIOD_DAYS: Record<string, number> = {
  TODAY: 1,
  '7D': 7,
  '30D': 30,
  '90D': 90
}

export function parsePeriodRange (req: IncomingMessage): { start: Date; end: Date } {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const periodParam = url.searchParams.get('period') ?? '7D'
  const days = PERIOD_DAYS[periodParam] ?? 7

  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end.getTime() - days * 86_400_000)
  start.setHours(0, 0, 0, 0)

  return { start, end }
}
