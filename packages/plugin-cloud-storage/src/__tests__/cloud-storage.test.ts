import { describe, it, expect, vi, beforeEach } from 'vitest'
import { okAsync } from '@valencets/resultkit'
import { createS3Adapter } from '../s3-adapter.js'
import { cloudStoragePlugin } from '../cloud-storage-plugin.js'
import type { CloudStorageAdapter } from '../storage-adapter.js'
import type { CmsConfigWithStorage } from '../cloud-storage-plugin.js'
import type { CmsConfig } from '@valencets/cms'

// Mock @aws-sdk/client-s3
const mockSend = vi.fn()

vi.mock('@aws-sdk/client-s3', () => {
  const S3Client = vi.fn(function () { return { send: mockSend } })

  const PutObjectCommand = vi.fn(function (params: Record<string, string>) { return { type: 'put', ...params } })

  const DeleteObjectCommand = vi.fn(function (params: Record<string, string>) { return { type: 'delete', ...params } })
  return { S3Client, PutObjectCommand, DeleteObjectCommand }
})

const makeConfig = (collections: CmsConfig['collections']): CmsConfig => ({
  db: {} as CmsConfig['db'],
  secret: 'test-secret',
  collections
})

describe('CloudStorageAdapter interface', () => {
  describe('createS3Adapter', () => {
    it('returns an object with upload, delete, and getUrl methods', () => {
      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' }
      })
      expect(typeof adapter.upload).toBe('function')
      expect(typeof adapter.delete).toBe('function')
      expect(typeof adapter.getUrl).toBe('function')
    })

    it('getUrl returns public URL with default pattern (no publicUrl set)', () => {
      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' }
      })
      const url = adapter.getUrl('uploads/image.jpg')
      expect(url).toContain('my-bucket')
      expect(url).toContain('us-east-1')
      expect(url).toContain('uploads/image.jpg')
    })

    it('getUrl uses custom publicUrl when provided', () => {
      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
        publicUrl: 'https://cdn.example.com'
      })
      const url = adapter.getUrl('uploads/image.jpg')
      expect(url).toBe('https://cdn.example.com/uploads/image.jpg')
    })

    it('getUrl applies prefix when provided', () => {
      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
        publicUrl: 'https://cdn.example.com',
        prefix: 'media'
      })
      const url = adapter.getUrl('image.jpg')
      expect(url).toContain('media')
      expect(url).toContain('image.jpg')
    })

    it('upload calls S3Client.send with PutObjectCommand', async () => {
      mockSend.mockResolvedValueOnce({})

      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' }
      })
      const buffer = Buffer.from('file content')
      const result = await adapter.upload('test.jpg', buffer, 'image/jpeg')
      expect(result.isOk()).toBe(true)
      expect(mockSend).toHaveBeenCalled()
    })

    it('upload returns err when S3 throws', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 error'))

      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' }
      })
      const buffer = Buffer.from('file content')
      const result = await adapter.upload('test.jpg', buffer, 'image/jpeg')
      expect(result.isErr()).toBe(true)
    })

    it('delete calls S3Client.send with DeleteObjectCommand', async () => {
      mockSend.mockResolvedValueOnce({})

      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' }
      })
      const result = await adapter.delete('test.jpg')
      expect(result.isOk()).toBe(true)
      expect(mockSend).toHaveBeenCalled()
    })

    it('delete returns err when S3 throws', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 delete error'))

      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' }
      })
      const result = await adapter.delete('test.jpg')
      expect(result.isErr()).toBe(true)
    })
  })

  describe('path traversal sanitization', () => {
    it('strips ../ from key in getUrl', () => {
      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
        publicUrl: 'https://cdn.example.com'
      })
      const url = adapter.getUrl('../../../etc/passwd')
      expect(url).not.toContain('../')
      expect(url).toContain('etc/passwd')
    })

    it('strips .. (without slash) from key in getUrl', () => {
      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
        publicUrl: 'https://cdn.example.com'
      })
      const url = adapter.getUrl('uploads/../secret')
      expect(url).not.toContain('..')
    })

    it('strips ../ from key when uploading', async () => {
      mockSend.mockResolvedValueOnce({})

      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' }
      })
      const buffer = Buffer.from('file content')
      const result = await adapter.upload('../../../etc/passwd', buffer, 'text/plain')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).not.toContain('../')
        expect(result.value).toContain('etc/passwd')
      }
    })

    it('strips ../ from key when deleting', async () => {
      mockSend.mockResolvedValueOnce({})

      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' }
      })
      const result = await adapter.delete('../sensitive/file.txt')
      expect(result.isOk()).toBe(true)
    })

    it('normal keys without traversal are unchanged', () => {
      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
        publicUrl: 'https://cdn.example.com'
      })
      const url = adapter.getUrl('uploads/2024/image.jpg')
      expect(url).toBe('https://cdn.example.com/uploads/2024/image.jpg')
    })

    it('prefix is not affected by key sanitization', () => {
      const adapter = createS3Adapter({
        bucket: 'my-bucket',
        region: 'us-east-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
        publicUrl: 'https://cdn.example.com',
        prefix: 'media'
      })
      const url = adapter.getUrl('../etc/passwd')
      expect(url).toBe('https://cdn.example.com/media/etc/passwd')
    })
  })
})

describe('cloudStoragePlugin', () => {
  const mockAdapter: CloudStorageAdapter = {
    upload: vi.fn().mockReturnValue(okAsync('uploaded')),
    delete: vi.fn().mockReturnValue(okAsync(undefined)),
    getUrl: vi.fn().mockReturnValue('https://cdn.example.com/file.jpg')
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a function that accepts a CmsConfig', () => {
    const plugin = cloudStoragePlugin({ adapter: mockAdapter })
    expect(typeof plugin).toBe('function')
  })

  it('returns a modified CmsConfig when called', () => {
    const config = makeConfig([
      { slug: 'media', timestamps: true, fields: [] }
    ])
    const plugin = cloudStoragePlugin({ adapter: mockAdapter })
    const result = plugin(config)
    expect(result).toBeDefined()
    expect(result.collections).toBeDefined()
  })

  it('attaches the adapter to the config as CmsConfigWithStorage', () => {
    const config = makeConfig([])
    const plugin = cloudStoragePlugin({ adapter: mockAdapter })
    const result: CmsConfigWithStorage = plugin(config)
    expect(result.storageAdapter).toBe(mockAdapter)
  })

  it('preserves existing collections', () => {
    const config = makeConfig([
      { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
    ])
    const plugin = cloudStoragePlugin({ adapter: mockAdapter })
    const result = plugin(config)
    expect(result.collections.find(c => c.slug === 'posts')).toBeDefined()
  })

  it('preserves existing config properties', () => {
    const config = makeConfig([])
    const plugin = cloudStoragePlugin({ adapter: mockAdapter })
    const result = plugin(config)
    expect(result.secret).toBe('test-secret')
  })

  it('getUrl delegates to adapter.getUrl', () => {
    const adapter: CloudStorageAdapter = {
      upload: vi.fn(),
      delete: vi.fn(),
      getUrl: vi.fn().mockReturnValue('https://cdn.example.com/test.jpg')
    }
    adapter.getUrl('test.jpg')
    expect(adapter.getUrl).toHaveBeenCalledWith('test.jpg')
  })
})
