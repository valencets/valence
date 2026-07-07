import type { ServerResponse } from 'node:http'

interface SSEClient {
  readonly sessionId: string
  readonly userId?: string
  readonly res: ServerResponse
}

const SAFE_EVENT_NAME = /^[a-zA-Z][a-zA-Z0-9_-]*$/
const HEARTBEAT_INTERVAL_MS = 30_000

function formatSSE (event: string, data: { readonly [key: string]: unknown }): string {
  if (!SAFE_EVENT_NAME.test(event)) {
    return ''
  }
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export class SSEBroadcaster {
  // Connections are keyed by a unique connection id, NOT by session id —
  // one session can hold several live tabs, and a stale tab's close event
  // must never evict a newer connection from the same session.
  private readonly _stores: Map<string, Map<number, SSEClient>>
  private _nextConnectionId: number
  private _heartbeat: ReturnType<typeof setInterval> | null

  private constructor () {
    this._stores = new Map()
    this._nextConnectionId = 1
    this._heartbeat = null
  }

  static create (): SSEBroadcaster {
    return new SSEBroadcaster()
  }

  connectionCount (storeSlug: string): number {
    const clients = this._stores.get(storeSlug)
    if (!clients) return 0
    return clients.size
  }

  addClient (storeSlug: string, sessionId: string, res: ServerResponse, userId?: string): number {
    let clients = this._stores.get(storeSlug)
    if (!clients) {
      clients = new Map()
      this._stores.set(storeSlug, clients)
    }

    res.setHeader('content-type', 'text/event-stream')
    res.setHeader('cache-control', 'no-cache')
    res.setHeader('connection', 'keep-alive')
    res.flushHeaders()

    const connectionId = this._nextConnectionId++
    clients.set(connectionId, { sessionId, res, ...(userId !== undefined ? { userId } : {}) })

    res.on('close', () => {
      this.removeClient(storeSlug, connectionId)
    })

    this._ensureHeartbeat()
    return connectionId
  }

  removeClient (storeSlug: string, connectionId: number): void {
    const clients = this._stores.get(storeSlug)
    if (!clients) return
    clients.delete(connectionId)
    if (clients.size === 0) {
      this._stores.delete(storeSlug)
    }
    if (this._stores.size === 0) {
      this._stopHeartbeat()
    }
  }

  broadcast (storeSlug: string, event: string, data: { readonly [key: string]: unknown }): void {
    const clients = this._stores.get(storeSlug)
    if (!clients) return
    const message = formatSSE(event, data)
    if (message.length === 0) return
    for (const client of clients.values()) {
      client.res.write(message)
    }
  }

  /** Deliver to every live connection of ONE user, across all their sessions */
  sendToUser (storeSlug: string, userId: string, event: string, data: { readonly [key: string]: unknown }): void {
    const clients = this._stores.get(storeSlug)
    if (!clients) return
    const message = formatSSE(event, data)
    if (message.length === 0) return
    for (const client of clients.values()) {
      if (client.userId === userId) {
        client.res.write(message)
      }
    }
  }

  /** Deliver to every live connection of ONE session (multi-tab sync) */
  sendToSession (storeSlug: string, sessionId: string, event: string, data: { readonly [key: string]: unknown }): void {
    const clients = this._stores.get(storeSlug)
    if (!clients) return
    const message = formatSSE(event, data)
    if (message.length === 0) return
    for (const client of clients.values()) {
      if (client.sessionId === sessionId) {
        client.res.write(message)
      }
    }
  }

  broadcastExcept (storeSlug: string, excludeSessionId: string, event: string, data: { readonly [key: string]: unknown }): void {
    const clients = this._stores.get(storeSlug)
    if (!clients) return
    const message = formatSSE(event, data)
    if (message.length === 0) return
    for (const client of clients.values()) {
      if (client.sessionId !== excludeSessionId) {
        client.res.write(message)
      }
    }
  }

  // Periodic comment frames keep intermediary proxies from reaping idle
  // connections; started with the first connection, stopped with the last.
  private _ensureHeartbeat (): void {
    if (this._heartbeat !== null) return
    const timer = setInterval(() => {
      for (const clients of this._stores.values()) {
        for (const client of clients.values()) {
          client.res.write(': ping\n\n')
        }
      }
    }, HEARTBEAT_INTERVAL_MS)
    if (typeof timer === 'object' && 'unref' in timer) {
      timer.unref()
    }
    this._heartbeat = timer
  }

  private _stopHeartbeat (): void {
    if (this._heartbeat === null) return
    clearInterval(this._heartbeat)
    this._heartbeat = null
  }
}
