import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createLocalStorage } from '../media/storage-adapter.js'
import type { StorageAdapter } from '../media/storage-adapter.js'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('createLocalStorage()', () => {
  let testDir: string
  let storage: StorageAdapter

  beforeEach(() => {
    testDir = join(tmpdir(), `valence-storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
    storage = createLocalStorage(testDir)
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  describe('write()', () => {
    it('writes a file and returns the stored filename', async () => {
      const data = Buffer.from('hello world')
      const result = await storage.write('test.txt', data)
      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe('test.txt')
    })

    it('file exists on disk after write', async () => {
      const data = Buffer.from('hello world')
      await storage.write('test.txt', data)
      const filePath = join(testDir, 'test.txt')
      expect(existsSync(filePath)).toBe(true)
      expect(readFileSync(filePath).toString()).toBe('hello world')
    })
  })

  describe('read()', () => {
    it('reads a previously written file', async () => {
      const data = Buffer.from('test content')
      await storage.write('read-test.txt', data)
      const result = await storage.read('read-test.txt')
      expect(result.isOk()).toBe(true)
      expect(result.unwrap().toString()).toBe('test content')
    })

    it('returns Err for non-existent file', async () => {
      const result = await storage.read('does-not-exist.txt')
      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr().code).toBe('NOT_FOUND')
    })
  })

  describe('remove()', () => {
    it('deletes a file from disk', async () => {
      const data = Buffer.from('to be deleted')
      await storage.write('delete-me.txt', data)
      const result = await storage.remove('delete-me.txt')
      expect(result.isOk()).toBe(true)
      expect(existsSync(join(testDir, 'delete-me.txt'))).toBe(false)
    })

    it('returns Err for non-existent file', async () => {
      const result = await storage.remove('does-not-exist.txt')
      expect(result.isErr()).toBe(true)
    })
  })

  describe('url()', () => {
    it('returns a media URL path for a filename', () => {
      const url = storage.url('abc123.jpg')
      expect(url).toBe('/media/abc123.jpg')
    })

    it('URL-encodes special characters', () => {
      const url = storage.url('file name.jpg')
      expect(url).toBe('/media/file%20name.jpg')
    })
  })

  describe('path traversal protection', () => {
    it('strips directory traversal from filename on write', async () => {
      const data = Buffer.from('safe content')
      const result = await storage.write('../evil.txt', data)
      expect(result.isOk()).toBe(true)
      // basename strips the ../ so it writes 'evil.txt' inside testDir
      expect(result.unwrap()).toBe('evil.txt')
      expect(existsSync(join(testDir, 'evil.txt'))).toBe(true)
    })

    it('strips directory traversal from filename on read', async () => {
      const data = Buffer.from('safe')
      await storage.write('safe.txt', data)
      const result = await storage.read('../safe.txt')
      // basename strips ../ so it reads 'safe.txt' from testDir
      expect(result.isOk()).toBe(true)
    })
  })
})
