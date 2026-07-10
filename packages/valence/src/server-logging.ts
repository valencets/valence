import { createLogger, parseLogLevel } from '@valencets/core/server'
import type { Logger } from '@valencets/core/server'

// One request logger for the dev and start servers. The level string comes
// from the config boundary (cli.ts reads the LOG_LEVEL variable) so this module
// never touches the environment directly. Every line carries `service: valence`, which keeps request
// lines attributable when the app is one of several processes shipping JSON to
// a shared log stream.
export function buildRequestLogger (level: string | undefined): Logger {
  return createLogger({ level: parseLogLevel(level), base: { service: 'valence' } })
}
