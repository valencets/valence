// @vitest-environment node
import { describe, it, expect } from 'vitest'

// #349 audit — fragment-swap executed `new DOMParser()` at module scope,
// so any transitive import in a DOM-less runtime crashed with
// "DOMParser is not defined" (e.g. `valence telemetry:aggregate` importing
// @valencets/telemetry → init.ts → core client modules). DOM construction
// must be lazy: importable everywhere, DOM required only at call time.

describe('DOM-less runtime imports', () => {
  it('fragment-swap imports without a DOM', async () => {
    const mod = await import('../../router/fragment-swap.js')
    expect(typeof mod.parseHtml).toBe('function')
  })

  it('the telemetry engine imports without a DOM', async () => {
    const mod = await import('../../telemetry/index.js')
    expect(mod).toBeDefined()
  })

  it('parseHtml still works when a DOM exists at call time', async () => {
    const { Window } = await import('happy-dom')
    const window = new Window()
    const globalWithDom = globalThis as { DOMParser?: unknown }
    const previous = globalWithDom.DOMParser
    globalWithDom.DOMParser = window.DOMParser

    const { parseHtml } = await import('../../router/fragment-swap.js')
    const result = parseHtml('<html><body><p>hi</p></body></html>')

    expect(result.isOk()).toBe(true)

    if (previous === undefined) {
      delete globalWithDom.DOMParser
    } else {
      globalWithDom.DOMParser = previous
    }
  })
})
