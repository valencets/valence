import type { DbConfig, DbError, DbPool } from '@valencets/db'
import type { ResultAsync } from 'neverthrow'
import { log } from './cli-utils.js'

interface PoolFactory {
  readonly createPool: (config: DbConfig) => DbPool
  readonly closePool: (pool: DbPool) => ResultAsync<void, DbError>
}

export function toDevDbConfig (config: DbConfig): DbConfig {
  const suffix = '_dev'
  if (config.database.endsWith(suffix)) {
    return config
  }
  return { ...config, database: config.database + suffix }
}

export async function ensureDevDatabase (config: DbConfig, deps: PoolFactory): Promise<void> {
  const devDbName = toDevDbConfig(config).database
  const maintenanceConfig: DbConfig = { ...config, database: 'postgres' }
  const maintenancePool = deps.createPool(maintenanceConfig)

  log(`Ensuring dev database "${devDbName}" exists...`)

  const sqlStatement = `CREATE DATABASE "${devDbName}"`
  await maintenancePool.sql.unsafe(sqlStatement).catch(() => {
    /* database already exists — safe to ignore */
  })

  await deps.closePool(maintenancePool)
}
