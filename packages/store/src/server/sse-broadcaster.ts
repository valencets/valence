import type { ServerResponse } from 'node:http'

interface SSEClient {
  readonly sessionId: string
  readonly res: ServerResponse
}

const SAFE_EVENT_NAME = /^[a-zA-Z][a-zA-Z0-9_-]*$/

function formatSSE (event: string, data: { [key: string]: string | number | boolean | null }): string {
  if (!SAFE_EVENT_NAME.test(event)) {
    return ''
  }
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export class SSEBroadcaster {
  private readonly _stores: Map<string, Map<string, SSEClient>>

  private constructor () {
    this._stores = new Map()
  }

  static create (): SSEBroadcaster {
    return new SSEBroadcaster()
  }

  connectionCount (storeSlug: string): number {
    const clients = this._stores.get(storeSlug)
    if (!clients) return 0
    return clients.size
  }

  addClient (storeSlug: string, sessionId: string, res: ServerResponse): void {
    let clients = this._stores.get(storeSlug)
    if (!clients) {
      clients = new Map()
      this._stores.set(storeSlug, clients)
    }

    res.setHeader('content-type', 'text/event-stream')
    res.setHeader('cache-control', 'no-cache')
    res.setHeader('connection', 'keep-alive')
    res.flushHeaders()

    clients.set(sessionId, { sessionId, res })

    res.on('close', () => {
      this.removeClient(storeSlug, sessionId)
    })
  }

  removeClient (storeSlug: string, sessionId: string): void {
    const clients = this._stores.get(storeSlug)
    if (!clients) return
    clients.delete(sessionId)
    if (clients.size === 0) {
      this._stores.delete(storeSlug)
    }
  }

  broadcast (storeSlug: string, event: string, data: { [key: string]: string | number | boolean | null }): void {
    const clients = this._stores.get(storeSlug)
    if (!clients) return
    const message = formatSSE(event, data)
    for (const client of clients.values()) {
      client.res.write(message)
    }
  }

  broadcastExcept (storeSlug: string, excludeSessionId: string, event: string, data: { [key: string]: string | number | boolean | null }): void {
    const clients = this._stores.get(storeSlug)
    if (!clients) return
    const message = formatSSE(event, data)
    for (const client of clients.values()) {
      if (client.sessionId !== excludeSessionId) {
        client.res.write(message)
      }
    }
  }
}
