import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DEPLOY_DIR = resolve(import.meta.dirname, '../../../deploy')

describe('deployment files', () => {
  it('provision.sh exists and is a bash script', () => {
    const path = resolve(DEPLOY_DIR, 'provision.sh')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content.startsWith('#!/usr/bin/env bash')).toBe(true)
  })
  it('provision.sh has version-locked installs', () => {
    const content = readFileSync(resolve(DEPLOY_DIR, 'provision.sh'), 'utf-8')
    expect(content).toContain('NODE_MAJOR=')
    expect(content).toContain('CADDY_VERSION=')
    expect(content).toContain('wireguard-tools')
  })

  it('systemd service exists with correct ExecStart', () => {
    const content = readFileSync(resolve(DEPLOY_DIR, 'inertia-studio.service'), 'utf-8')
    expect(content).toContain('ExecStart=')
    expect(content).toContain('entry.js')
    expect(content).toContain('Restart=on-failure')
    expect(content).toContain('[Install]')
  })

  it('env.production has all required variables', () => {
    const content = readFileSync(resolve(DEPLOY_DIR, 'env.production'), 'utf-8')
    const keys = content.split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => l.split('=')[0])

    const required = [
      'STUDIO_PORT', 'STUDIO_HOST',
      'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
      'DB_MAX_CONNECTIONS', 'ADMIN_TOKEN', 'NODE_ENV', 'SITE_ID', 'BUSINESS_TYPE'
    ]
    for (const key of required) {
      expect(keys).toContain(key)
    }
  })

  it('Caddyfile proxies to the port defined in env.production', () => {
    const env = readFileSync(resolve(DEPLOY_DIR, 'env.production'), 'utf-8')
    const portMatch = env.match(/STUDIO_PORT=(\d+)/)
    expect(portMatch).not.toBeNull()

    const caddyfile = readFileSync(resolve(DEPLOY_DIR, 'Caddyfile'), 'utf-8')
    expect(caddyfile).toContain(`localhost:${portMatch![1]}`)
  })
})
