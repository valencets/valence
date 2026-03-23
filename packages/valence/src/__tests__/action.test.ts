import { describe, it, expect, vi } from 'vitest'
import type { IncomingMessage } from 'node:http'
import { executeAction, readRequestBody } from '../action.js'
import type { ActionContext, ActionResult } from '../define-config.js'
import type { DbPool } from '@valencets/db'
import type { CmsInstance } from '@valencets/cms'

const makeCtx = (overrides: Partial<ActionContext> = {}): ActionContext => ({
  params: {},
  body: new URLSearchParams(),
  req: {} as IncomingMessage,
  pool: {} as DbPool,
  cms: {} as CmsInstance,
  ...overrides
})

describe('executeAction', () => {
  it('returns Ok with ActionResult on success', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({
      redirect: '/success'
    })
    const result = await executeAction(action, makeCtx())
    expect(result.isOk()).toBe(true)
  })

  it('returns the redirect from the action', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({
      redirect: '/done'
    })
    const result = await executeAction(action, makeCtx())
    expect(result.unwrap().redirect).toBe('/done')
  })

  it('returns errors from the action', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({
      errors: { email: ['Invalid email format'] }
    })
    const result = await executeAction(action, makeCtx())
    expect(result.unwrap().errors?.['email']).toEqual(['Invalid email format'])
  })

  it('passes context to the action function', async () => {
    const receivedCtx: ActionContext[] = []
    const action = async (ctx: ActionContext): Promise<ActionResult> => {
      receivedCtx.push(ctx)
      return {}
    }
    const ctx = makeCtx({ params: { id: '7' } })
    await executeAction(action, ctx)
    expect(receivedCtx[0]?.params['id']).toBe('7')
  })

  it('passes URLSearchParams body to action', async () => {
    const receivedBody: URLSearchParams[] = []
    const action = async (ctx: ActionContext): Promise<ActionResult> => {
      receivedBody.push(ctx.body)
      return {}
    }
    const ctx = makeCtx({ body: new URLSearchParams('name=Alice&age=30') })
    await executeAction(action, ctx)
    expect(receivedBody[0]?.get('name')).toBe('Alice')
    expect(receivedBody[0]?.get('age')).toBe('30')
  })

  it('returns Err when action throws', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => {
      throw new Error('DB write failed')
    }
    const result = await executeAction(action, makeCtx())
    expect(result.isErr()).toBe(true)
  })

  it('Err has ACTION_FAILED code when action throws', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => {
      throw new Error('constraint violation')
    }
    const result = await executeAction(action, makeCtx())
    if (result.isErr()) {
      expect(result.error.code).toBe('ACTION_FAILED')
    }
  })

  it('Err message includes original error message', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => {
      throw new Error('unique constraint violated')
    }
    const result = await executeAction(action, makeCtx())
    if (result.isErr()) {
      expect(result.error.message).toContain('unique constraint violated')
    }
  })

  it('returns Err with ACTION_FAILED when action rejects with non-Error', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => {
      return Promise.reject(new Error('non-error rejection'))
    }
    const result = await executeAction(action, makeCtx())
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('ACTION_FAILED')
    }
  })

  it('returns data from action result', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({
      data: { id: 42, saved: true }
    })
    const result = await executeAction(action, makeCtx())
    expect(result.unwrap().data?.['id']).toBe(42)
  })

  it('returns status from action result', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({
      status: 422,
      errors: { name: ['Required'] }
    })
    const result = await executeAction(action, makeCtx())
    expect(result.unwrap().status).toBe(422)
  })

  it('is independent across multiple calls', async () => {
    let count = 0
    const action = async (_ctx: ActionContext): Promise<ActionResult> => {
      count++
      return { data: { call: count } }
    }
    const r1 = await executeAction(action, makeCtx())
    const r2 = await executeAction(action, makeCtx())
    expect(r1.unwrap().data?.['call']).toBe(1)
    expect(r2.unwrap().data?.['call']).toBe(2)
  })
})

describe('readRequestBody', () => {
  it('reads body chunks from the request stream', async () => {
    const eventHandlers = new Map<string, (arg: Buffer | Error) => void>()
    const mockReq = {
      on: vi.fn((event: string, handler: (arg: Buffer | Error) => void) => {
        eventHandlers.set(event, handler)
        return mockReq
      })
    } as unknown as IncomingMessage

    const promise = readRequestBody(mockReq)

    // Simulate data + end events
    const dataHandler = eventHandlers.get('data')
    const endHandler = eventHandlers.get('end')
    dataHandler?.(Buffer.from('hello=world'))
    endHandler?.(Buffer.from(''))

    const result = await promise
    expect(result).toBe('hello=world')
  })

  it('concatenates multiple chunks', async () => {
    const eventHandlers = new Map<string, (arg: Buffer | Error) => void>()
    const mockReq = {
      on: vi.fn((event: string, handler: (arg: Buffer | Error) => void) => {
        eventHandlers.set(event, handler)
        return mockReq
      })
    } as unknown as IncomingMessage

    const promise = readRequestBody(mockReq)

    const dataHandler = eventHandlers.get('data')
    const endHandler = eventHandlers.get('end')
    dataHandler?.(Buffer.from('name=Alice'))
    dataHandler?.(Buffer.from('&age=30'))
    endHandler?.(Buffer.from(''))

    const result = await promise
    expect(result).toBe('name=Alice&age=30')
  })

  it('resolves empty string when no data events fire', async () => {
    const eventHandlers = new Map<string, (arg: Buffer | Error) => void>()
    const mockReq = {
      on: vi.fn((event: string, handler: (arg: Buffer | Error) => void) => {
        eventHandlers.set(event, handler)
        return mockReq
      })
    } as unknown as IncomingMessage

    const promise = readRequestBody(mockReq)
    const endHandler = eventHandlers.get('end')
    endHandler?.(Buffer.from(''))

    const result = await promise
    expect(result).toBe('')
  })

  it('rejects when the stream errors', async () => {
    const eventHandlers = new Map<string, (arg: Buffer | Error) => void>()
    const mockReq = {
      on: vi.fn((event: string, handler: (arg: Buffer | Error) => void) => {
        eventHandlers.set(event, handler)
        return mockReq
      })
    } as unknown as IncomingMessage

    const promise = readRequestBody(mockReq)
    const errorHandler = eventHandlers.get('error')
    errorHandler?.(new Error('stream error'))

    await expect(promise).rejects.toThrow('stream error')
  })
})
