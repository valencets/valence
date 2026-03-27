import type { StoreState } from '../types.js'

type StateCallback = (state: StoreState) => void
type ConfirmedCallback = (data: { mutationId: number }) => void
type RejectedCallback = (data: { mutationId: number; error: { code: string; message: string } }) => void
type FragmentCallback = (data: { selector: string; html: string }) => void

interface SSECallbacks {
  state: StateCallback[]
  confirmed: ConfirmedCallback[]
  rejected: RejectedCallback[]
  fragment: FragmentCallback[]
}

export class SSEListener {
  private readonly _url: string
  private _source: EventSource | null
  private _connected: boolean
  private readonly _callbacks: SSECallbacks

  private constructor (url: string) {
    this._url = url
    this._source = null
    this._connected = true
    this._callbacks = {
      state: [],
      confirmed: [],
      rejected: [],
      fragment: []
    }
    this._connect()
  }

  static create (url: string): SSEListener {
    return new SSEListener(url)
  }

  private _connect (): void {
    if (typeof EventSource === 'undefined') return

    this._source = new EventSource(this._url)

    this._source.addEventListener('state', (event: MessageEvent) => {
      this._dispatch('state', JSON.parse(event.data as string))
    })

    this._source.addEventListener('confirmed', (event: MessageEvent) => {
      this._dispatch('confirmed', JSON.parse(event.data as string))
    })

    this._source.addEventListener('rejected', (event: MessageEvent) => {
      this._dispatch('rejected', JSON.parse(event.data as string))
    })

    this._source.addEventListener('fragment', (event: MessageEvent) => {
      this._dispatch('fragment', JSON.parse(event.data as string))
    })
  }

  private _dispatch (event: keyof SSECallbacks, data: StoreState | { mutationId: number } | { mutationId: number; error: { code: string; message: string } } | { selector: string; html: string }): void {
    if (!this._connected) return
    const callbacks = this._callbacks[event]
    for (const cb of callbacks) {
      (cb as (data: typeof data) => void)(data)
    }
  }

  onState (callback: StateCallback): void {
    this._callbacks.state.push(callback)
  }

  onConfirmed (callback: ConfirmedCallback): void {
    this._callbacks.confirmed.push(callback)
  }

  onRejected (callback: RejectedCallback): void {
    this._callbacks.rejected.push(callback)
  }

  onFragment (callback: FragmentCallback): void {
    this._callbacks.fragment.push(callback)
  }

  disconnect (): void {
    this._connected = false
    if (this._source) {
      this._source.close()
      this._source = null
    }
  }

  /** Test-only: simulate an SSE event without a real server */
  _simulateEvent (event: keyof SSECallbacks, data: StoreState | { mutationId: number } | { mutationId: number; error: { code: string; message: string } } | { selector: string; html: string }): void {
    this._dispatch(event, data)
  }
}
