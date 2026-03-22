import { ResultAsync } from 'neverthrow'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import type { CloudStorageAdapter, StorageError } from './storage-adapter.js'

export interface S3Credentials {
  readonly accessKeyId: string
  readonly secretAccessKey: string
}

export interface S3AdapterOptions {
  readonly bucket: string
  readonly region: string
  readonly credentials: S3Credentials
  readonly prefix?: string | undefined
  readonly publicUrl?: string | undefined
}

function buildKey (key: string, prefix: string | undefined): string {
  const segments = key.split('/').filter(s => s !== '..' && s !== '.')
  const sanitized = segments.join('/')
  return prefix !== undefined && prefix !== '' ? `${prefix}/${sanitized}` : sanitized
}

function buildDefaultUrl (key: string, bucket: string, region: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

function buildPublicUrl (key: string, publicUrl: string): string {
  const base = publicUrl.replace(/\/$/, '')
  return `${base}/${key}`
}

export function createS3Adapter (opts: S3AdapterOptions): CloudStorageAdapter {
  const client = new S3Client({
    region: opts.region,
    credentials: {
      accessKeyId: opts.credentials.accessKeyId,
      secretAccessKey: opts.credentials.secretAccessKey
    }
  })

  return {
    upload (key: string, buffer: Buffer, contentType?: string) {
      const fullKey = buildKey(key, opts.prefix)
      const command = new PutObjectCommand({
        Bucket: opts.bucket,
        Key: fullKey,
        Body: buffer,
        ContentType: contentType
      })
      return ResultAsync.fromPromise(
        client.send(command).then(() => fullKey),
        (e: unknown): StorageError => ({
          message: e instanceof Error ? e.message : 'Upload failed'
        })
      )
    },

    delete (key: string) {
      const fullKey = buildKey(key, opts.prefix)
      const command = new DeleteObjectCommand({
        Bucket: opts.bucket,
        Key: fullKey
      })
      return ResultAsync.fromPromise(
        client.send(command).then(() => undefined as void),
        (e: unknown): StorageError => ({
          message: e instanceof Error ? e.message : 'Delete failed'
        })
      )
    },

    getUrl (key: string): string {
      const fullKey = buildKey(key, opts.prefix)
      if (opts.publicUrl !== undefined && opts.publicUrl !== '') {
        return buildPublicUrl(fullKey, opts.publicUrl)
      }
      return buildDefaultUrl(fullKey, opts.bucket, opts.region)
    }
  }
}
