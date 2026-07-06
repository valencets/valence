import { fromThrowable } from '@valencets/resultkit'
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

const safeParse = fromThrowable(
  (text: string) => JSON.parse(text) as { readonly [key: string]: unknown },
  () => null
)

export class SSEListener {
  private readonly _url: string
  private _source: EventSource | null
  private _disposed: boolean
  private readonly _callbacks: SSECallbacks

  private constructor (url: string) {
    this._url = url
    this._source = null
    this._disposed = false
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

  /** True only while a live EventSource is open */
  get connected (): boolean {
    return this._source !== null
  }

  private _connect (): void {
    if (typeof EventSource === 'undefined') return

    this._source = new EventSource(this._url)

    const events: Array<keyof SSECallbacks> = ['state', 'confirmed', 'rejected', 'fragment']
    for (const event of events) {
      this._source.addEventListener(event, (messageEvent: MessageEvent) => {
        // Malformed payloads are dropped, never thrown — a broken SSE frame
        // must not take down the whole event stream handler.
        const parsed = safeParse(messageEvent.data as string)
        if (parsed.isErr() || parsed.value === null || typeof parsed.value !== 'object') return
        this._dispatch(event, parsed.value)
      })
    }
  }

  private _dispatch (event: keyof SSECallbacks, data: { readonly [key: string]: unknown }): void {
    if (this._disposed) return
    const callbacks = this._callbacks[event]
    for (const cb of callbacks) {
      (cb as (d: { readonly [key: string]: unknown }) => void)(data)
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
    this._disposed = true
    if (this._source) {
      this._source.close()
      this._source = null
    }
  }

  /** Test-only: simulate an SSE event without a real server */
  _simulateEvent (event: keyof SSECallbacks, data: { readonly [key: string]: unknown }): void {
    this._dispatch(event, data)
  }
}
