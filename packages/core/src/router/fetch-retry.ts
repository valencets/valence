export interface AbortableFetchHandle {
  readonly fetch: typeof fetch
  readonly abort: () => void
  readonly isInFlight: () => boolean
}

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

function isAbortError (error: DOMException | Error): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isRetryableResponse (response: Response): boolean {
  return response.status >= 500
}

function delay (ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const id = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
    function onAbort (): void {
      clearTimeout(id)
      resolve()
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

type FetchAttemptResult =
  | { done: true; response: Response }
  | { done: false; error: DOMException | Error | null }

async function attemptFetch (
  fetchFn: typeof fetch,
  url: string | RequestInfo | URL,
  init: RequestInit | undefined,
  signal: AbortSignal,
  attempt: number
): Promise<FetchAttemptResult> {
  if (signal.aborted) {
    return { done: false, error: new DOMException('The operation was aborted.', 'AbortError') }
  }

  return fetchFn(url, { ...init, signal }).then(async (response) => {
    if (signal.aborted) {
      return { done: false, error: new DOMException('The operation was aborted.', 'AbortError') } as FetchAttemptResult
    }
    if (isRetryableResponse(response) && attempt < MAX_ATTEMPTS) {
      if (attempt >= 2) {
        await delay(RETRY_DELAY_MS, signal)
      }
      return { done: false, error: null } as FetchAttemptResult
    }
    return { done: true, response } as FetchAttemptResult
  }).catch((error: DOMException | Error) => {
    return { done: false, error } as FetchAttemptResult
  })
}

export function createAbortableFetch (fetchFn: typeof fetch): AbortableFetchHandle {
  let controller: AbortController | null = null
  let inFlight = false

  function abort (): void {
    if (controller !== null) {
      controller.abort()
      controller = null
    }
    inFlight = false
  }

  async function fetchWithRetry (url: string | RequestInfo | URL, init?: RequestInit): Promise<Response> {
    abort()
    controller = new AbortController()
    const { signal } = controller
    inFlight = true

    let lastError: DOMException | Error | null = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = await attemptFetch(fetchFn, url, init, signal, attempt)

      if (result.done) {
        inFlight = false
        return result.response
      }

      if (result.error !== null && isAbortError(result.error)) {
        inFlight = false
        return Promise.reject(result.error)
      }

      lastError = result.error

      if (attempt >= MAX_ATTEMPTS) break

      // Wait between retries — allows abort signal to interrupt the delay
      if (attempt >= 2) {
        await delay(RETRY_DELAY_MS, signal)
      }

      if (signal.aborted) {
        inFlight = false
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
      }
    }

    inFlight = false

    if (signal.aborted) {
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
    }

    return Promise.reject(lastError ?? new Error('Fetch failed after all retries'))
  }

  return {
    fetch: fetchWithRetry,
    abort,
    isInFlight: () => inFlight
  }
}
