import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  resolveClientEntry,
  createClientBundler,
  registerClientBundleRoute,
  CLIENT_BUNDLE_PATH
} from '../client-bundler.js'
import type { ClientBundler } from '../client-bundler.js'
import type { RouteHandler } from '../define-config.js'

interface CapturedResponse {
  statusCode: number
  headers: { [key: string]: string }
  body: string
}

function mockRes (): ServerResponse & { _captured: CapturedResponse } {
  const captured: CapturedResponse = { statusCode: 0, headers: {}, body: '' }
  const res = Object.assign(new EventEmitter(), {
    _captured: captured,
    writeHead (status: number, headers?: { [key: string]: string }) {
      captured.statusCode = status
      if (headers) Object.assign(captured.headers, headers)
      return res
    },
    setHeader (name: string, value: string) { captured.headers[name] = value },
    end (body?: string) { if (body) captured.body = body }
  })
  return res as unknown as ServerResponse & { _captured: CapturedResponse }
}

function mockReq (headers?: { [key: string]: string }): IncomingMessage {
  return Object.assign(new EventEmitter(), { headers: headers ?? {}, method: 'GET' }) as unknown as IncomingMessage
}

function makeProject (entrySource?: string, helperSource?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'valence-bundler-'))
  if (entrySource !== undefined) {
    mkdirSync(join(dir, 'src', 'app'), { recursive: true })
    writeFileSync(join(dir, 'src', 'app', 'client.ts'), entrySource)
    if (helperSource !== undefined) {
      writeFileSync(join(dir, 'src', 'app', 'greeting.ts'), helperSource)
    }
  }
  return dir
}

const cleanups: Array<() => Promise<void> | void> = []
afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()!()
  }
})

function track (dir: string, bundler?: ClientBundler | null): void {
  if (bundler) cleanups.push(() => bundler.dispose())
  cleanups.push(() => { rmSync(dir, { recursive: true, force: true }) })
}

async function makeBundler (dir: string, watch: boolean): Promise<ClientBundler | null> {
  const result = await createClientBundler({ projectDir: dir, watch })
  const bundler = result.match(
    (value) => value,
    () => null
  )
  track(dir, bundler)
  return bundler
}

describe('resolveClientEntry', () => {
  it('finds the conventional src/app/client.ts entry', () => {
    const dir = makeProject('export {}')
    track(dir)
    expect(resolveClientEntry(dir)).toBe(join(dir, 'src', 'app', 'client.ts'))
  })

  it('returns null when no client entry exists', () => {
    const dir = makeProject()
    track(dir)
    expect(resolveClientEntry(dir)).toBeNull()
  })
})

describe('createClientBundler', () => {
  it('bundles a TypeScript entry and its imports into one browser ESM bundle', async () => {
    const dir = makeProject(
      "import { greeting } from './greeting.js'\nconst el: HTMLElement | null = document.querySelector('#app')\nif (el) el.textContent = greeting('valence')\n",
      "export function greeting (name: string): string { return 'hello ' + name }\n"
    )
    const bundler = await makeBundler(dir, false)
    expect(bundler).not.toBeNull()

    const bundle = bundler!.getBundle()
    expect(bundle).not.toBeNull()
    expect(bundle!.js).toContain('hello ')
    // TypeScript annotations are compiled away, not shipped
    expect(bundle!.js).not.toContain('HTMLElement | null')
    expect(bundle!.etag.length).toBeGreaterThan(8)
  })

  it('yields a null bundle and reports the error when the entry does not compile', async () => {
    const dir = makeProject('const oops: number = {{{\n')
    const logged: string[] = []
    const result = await createClientBundler({ projectDir: dir, watch: false, log: (msg) => { logged.push(msg) } })
    const bundler = result.match((value) => value, () => null)
    track(dir, bundler)

    expect(bundler).not.toBeNull()
    expect(bundler!.getBundle()).toBeNull()
    expect(logged.some(msg => msg.includes('client bundle'))).toBe(true)
  })

  it('rebuilds when the entry changes in watch mode', async () => {
    const dir = makeProject('console.log("version-one")\n')
    const bundler = await makeBundler(dir, true)
    expect(bundler!.getBundle()!.js).toContain('version-one')

    writeFileSync(join(dir, 'src', 'app', 'client.ts'), 'console.log("version-two")\n')

    let js = ''
    for (let attempt = 0; attempt < 100; attempt++) {
      js = bundler!.getBundle()?.js ?? ''
      if (js.includes('version-two')) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    expect(js).toContain('version-two')
  })
})

describe('registerClientBundleRoute', () => {
  async function serve (bundler: ClientBundler, headers?: { [key: string]: string }): Promise<CapturedResponse> {
    const routes = new Map<string, RouteHandler>()
    registerClientBundleRoute((method, path, handler) => { routes.set(`${method} ${path}`, handler) }, bundler)
    const handler = routes.get(`GET ${CLIENT_BUNDLE_PATH}`)!
    const res = mockRes()
    await handler(mockReq(headers), res, {})
    return res._captured
  }

  it('serves the bundle as JavaScript with an ETag', async () => {
    const dir = makeProject('console.log("served")\n')
    const bundler = await makeBundler(dir, false)

    const captured = await serve(bundler!)
    expect(captured.statusCode).toBe(200)
    expect(captured.headers['Content-Type']).toContain('javascript')
    expect(captured.headers['ETag']).toBeDefined()
    expect(captured.body).toContain('served')
  })

  it('answers 304 when the client already holds the current bundle', async () => {
    const dir = makeProject('console.log("cached")\n')
    const bundler = await makeBundler(dir, false)

    const first = await serve(bundler!)
    const second = await serve(bundler!, { 'if-none-match': first.headers['ETag']! })
    expect(second.statusCode).toBe(304)
    expect(second.body).toBe('')
  })

  it('answers 503 while no bundle is available', async () => {
    const dir = makeProject('const broken: string = {{{\n')
    const bundler = await makeBundler(dir, false)

    const captured = await serve(bundler!)
    expect(captured.statusCode).toBe(503)
  })
})
