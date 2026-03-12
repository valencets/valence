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
    expect(content).toContain('dist/server/entry.js')
    expect(content).toContain('Restart=on-failure')
  })

  it('env.production has required variables', () => {
    const content = readFileSync(resolve(DEPLOY_DIR, 'env.production'), 'utf-8')
    expect(content).toContain('STUDIO_PORT=5173')
    expect(content).toContain('DB_NAME=inertia_studio')
    expect(content).toContain('ADMIN_TOKEN=')
  })

  it('Caddyfile proxies to port 5173', () => {
    const content = readFileSync(resolve(DEPLOY_DIR, 'Caddyfile'), 'utf-8')
    expect(content).toContain('localhost:5173')
    expect(content).toContain(':8443')
  })
})
