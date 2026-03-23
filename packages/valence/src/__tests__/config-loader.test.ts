import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadEnvConfig } from '../config-loader.js'

const ORIGINAL_ENV = { ...process.env }

describe('loadEnvConfig', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.DB_HOST
    delete process.env.DB_PORT
    delete process.env.DB_NAME
    delete process.env.DB_NAME_DEV
    delete process.env.DB_USER
    delete process.env.DB_PASSWORD
    delete process.env.DB_SSLMODE
    delete process.env.DB_SSLROOTCERT
    delete process.env.DB_SSLROOTCERT_FILE
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('loads sslmode and sslrootcert from environment variables', async () => {
    process.env.DB_HOST = 'localhost'
    process.env.DB_NAME = 'valence'
    process.env.DB_USER = 'app'
    process.env.DB_PASSWORD = 'secret'
    process.env.DB_SSLMODE = 'verify-full'
    process.env.DB_SSLROOTCERT = '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----'

    const config = loadEnvConfig()

    expect(config).not.toBeNull()
    expect(config?.sslmode).toBe('verify-full')
    expect(config?.sslrootcert).toContain('BEGIN CERTIFICATE')
  })

  it('prefers DB_SSLROOTCERT_FILE contents over inline DB_SSLROOTCERT', async () => {
    process.env.DB_HOST = 'localhost'
    process.env.DB_NAME = 'valence'
    process.env.DB_USER = 'app'
    process.env.DB_PASSWORD = 'secret'
    process.env.DB_SSLMODE = 'verify-ca'
    process.env.DB_SSLROOTCERT = 'inline-cert'
    process.env.DB_SSLROOTCERT_FILE = '/tmp/valence-test-ca.pem'

    const { writeFileSync } = await import('node:fs')
    writeFileSync('/tmp/valence-test-ca.pem', 'file-cert')

    const config = loadEnvConfig()

    expect(config).not.toBeNull()
    expect(config?.sslrootcert).toBe('file-cert')
  })

  it('returns null when DB_PASSWORD is missing', async () => {
    process.env.DB_HOST = 'localhost'
    process.env.DB_NAME = 'valence'
    process.env.DB_USER = 'app'

    expect(loadEnvConfig()).toBeNull()
  })

  it('returns null when DB_SSLMODE is invalid', async () => {
    process.env.DB_HOST = 'localhost'
    process.env.DB_NAME = 'valence'
    process.env.DB_USER = 'app'
    process.env.DB_PASSWORD = 'secret'
    process.env.DB_SSLMODE = 'verify_ca'

    expect(loadEnvConfig()).toBeNull()
  })
})
