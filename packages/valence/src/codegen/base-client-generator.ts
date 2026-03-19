// Generated client is user-land code — throw is intentional here
// (Valence internals use Result monads, but user API clients use throw)
export function generateBaseClient (): string {
  return `// @generated — regenerated from valence.config.ts. DO NOT EDIT.

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
      return request<T[]>(basePath)
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
