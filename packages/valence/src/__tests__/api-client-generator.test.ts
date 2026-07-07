import { describe, it, expect } from 'vitest'
import { generateApiClient } from '../codegen/api-client-generator.js'
import { collection, field } from '@valencets/cms'

describe('generateApiClient', () => {
  it('generates valid identifier for hyphenated collection slug', () => {
    const col = collection({
      slug: 'chat-messages',
      fields: [field.text({ name: 'content', required: true })]
    })
    const output = generateApiClient(col)
    expect(output).toContain('export const chatMessages = {')
    expect(output).not.toContain('export const chat-messages')
  })

  it('generates valid identifier for simple collection slug', () => {
    const col = collection({
      slug: 'users',
      fields: [field.text({ name: 'name', required: true })]
    })
    const output = generateApiClient(col)
    expect(output).toContain('export const users = {')
  })

  it('preserves raw slug in the API path', () => {
    const col = collection({
      slug: 'chat-messages',
      fields: [field.text({ name: 'content', required: true })]
    })
    const output = generateApiClient(col)
    expect(output).toContain("apiClient<ChatMessage>('/api/chat-messages')")
  })
})

describe('generated base client REST envelope', () => {
  it('list() unwraps the paginated docs envelope so Promise<T[]> is honest', async () => {
    const { generateBaseClient } = await import('../codegen/base-client-generator.js')
    const output = generateBaseClient()
    expect(output).toContain('export interface Paginated<T>')
    expect(output).toContain('readonly docs: readonly T[]')
    // list() must reach through the envelope, not hand it back as T[]
    expect(output).toMatch(/list \(\): Promise<T\[\]>[\s\S]*?\.docs/)
    expect(output).toContain('listPaginated (): Promise<Paginated<T>>')
  })

  it('entity clients expose the paginated variant', () => {
    const col = collection({
      slug: 'presets',
      fields: [field.text({ name: 'title', required: true })]
    })
    const output = generateApiClient(col)
    expect(output).toContain('listPaginated: client.listPaginated')
  })
})
