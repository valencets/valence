// Generated client is user-land code — throw is intentional here
// (Valence internals use Result monads, but user API clients use throw)
export function generateBaseClient (): string {
  return `// @generated — regenerated from valence.config.ts. DO NOT EDIT.

/** The REST list envelope. Collections answer 401 for anonymous callers
 *  unless the collection declares public access, e.g.
 *  collection({ access: { read: () => true } }). */
export interface Paginated<T> {
  readonly docs: readonly T[]
  readonly totalDocs: number
  readonly page: number
  readonly totalPages: number
  readonly limit: number
  readonly hasNextPage: boolean
  readonly hasPrevPage: boolean
}

export function apiClient<T> (basePath: string) {
  async function request<R> (url: string, options?: RequestInit): Promise<R> {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    })
    if (!res.ok) {
      throw new Error(\`\${res.status} \${res.statusText}\`)
    }
    return res.json() as Promise<R>
  }

  return {
    async list (): Promise<T[]> {
      const page = await request<Paginated<T>>(basePath)
      return [...page.docs]
    },
    async listPaginated (): Promise<Paginated<T>> {
      return request<Paginated<T>>(basePath)
    },
    async get (id: string): Promise<T> {
      return request<T>(\`\${basePath}/\${id}\`)
    },
    async create (data: Partial<T>): Promise<T> {
      return request<T>(basePath, { method: 'POST', body: JSON.stringify(data) })
    },
    async update (id: string, data: Partial<T>): Promise<T> {
      return request<T>(\`\${basePath}/\${id}\`, { method: 'PATCH', body: JSON.stringify(data) })
    },
    async remove (id: string): Promise<void> {
      await request<void>(\`\${basePath}/\${id}\`, { method: 'DELETE' })
    }
  }
}
`
}
