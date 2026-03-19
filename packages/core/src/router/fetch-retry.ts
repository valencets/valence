export interface AbortableFetchHandle {
  readonly fetch: typeof fetch
  readonly abort: () => void
  readonly isInFlight: () => boolean
}

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

function isAbortError (error: unknown): boolean {
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

    try {
      let lastError: unknown
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (signal.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError')
        }

        try {
          const response = await fetchFn(url, { ...init, signal })

          if (signal.aborted) {
            throw new DOMException('The operation was aborted.', 'AbortError')
          }

          if (isRetryableResponse(response) && attempt < MAX_ATTEMPTS) {
            if (attempt >= 2) {
              await delay(RETRY_DELAY_MS, signal)
            }
            continue
          }
          return response
        } catch (error: unknown) {
          if (isAbortError(error)) throw error
          lastError = error
          if (attempt >= MAX_ATTEMPTS) break
          if (attempt >= 2) {
            await delay(RETRY_DELAY_MS, signal)
          }
        }
      }

      if (signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
      throw lastError
    } finally {
      inFlight = false
    }
  }

  return {
    fetch: fetchWithRetry,
    abort,
    isInFlight: () => inFlight
  }
}
