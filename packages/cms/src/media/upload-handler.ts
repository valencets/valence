import { ResultAsync } from 'neverthrow'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { writeFile } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getMimeType } from './media-config.js'
import type { UploadConfig } from './media-config.js'
import type { StorageAdapter } from './storage-adapter.js'
import { processImageSizes } from './image-processor.js'
import type { ProcessedImage } from './image-processor.js'
import { readRawBody } from '../api/read-body.js'

const MAX_UPLOAD_BYTES = 10_485_760
const SAFE_FILENAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif'
])

function isImageFile (mimeType: string): boolean {
  return IMAGE_MIMES.has(mimeType)
}

function generateStoredName (originalName: string): string {
  const ext = originalName.split('.').pop() ?? ''
  const prefix = randomBytes(16).toString('hex')
  return ext ? `${prefix}.${ext}` : prefix
}

export interface SizeMetadata {
  readonly filename: string
  readonly width: number
  readonly height: number
  readonly filesize: number
  readonly mimeType: string
}

export interface UploadResult {
  readonly filename: string
  readonly storedPath: string
  readonly mimeType: string
  readonly filesize: number
  readonly focalX?: number | undefined
  readonly focalY?: number | undefined
  readonly sizes?: Record<string, SizeMetadata> | undefined
}

function parseFocalPoint (req: IncomingMessage): { x: number; y: number } | undefined {
  const rawX = req.headers['x-focal-x']
  const rawY = req.headers['x-focal-y']
  const xStr = Array.isArray(rawX) ? rawX[0] : rawX
  const yStr = Array.isArray(rawY) ? rawY[0] : rawY
  if (xStr === undefined || yStr === undefined) return undefined
  const x = Number(xStr)
  const y = Number(yStr)
  if (Number.isNaN(x) || Number.isNaN(y)) return undefined
  return { x, y }
}

function buildSizeMetadata (
  processed: readonly ProcessedImage[],
  originalExt: string
): Record<string, SizeMetadata> {
  const sizes: Record<string, SizeMetadata> = {}
  for (const img of processed) {
    const ext = img.mimeType.split('/').pop() ?? originalExt
    sizes[img.name] = {
      filename: `${img.name}.${ext}`,
      width: img.width,
      height: img.height,
      filesize: img.filesize,
      mimeType: img.mimeType
    }
  }
  return sizes
}

function variantFilename (storedName: string, sizeName: string, ext: string): string {
  const base = storedName.split('.').slice(0, -1).join('.')
  return `${base}-${sizeName}.${ext}`
}

async function writeVariants (
  storage: StorageAdapter,
  storedName: string,
  processed: readonly ProcessedImage[]
): Promise<void> {
  for (const img of processed) {
    const ext = img.mimeType.split('/').pop() ?? 'bin'
    const name = variantFilename(storedName, img.name, ext)
    const result = await storage.write(name, img.buffer)
    if (result.isErr()) return
  }
}

function sendJson (res: ServerResponse, status: number, data: UploadResult): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function sendError (res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: message }))
}

function hasImageSizes (
  storage: StorageAdapter | undefined,
  mimeType: string,
  uploadConfig: UploadConfig | undefined
): uploadConfig is UploadConfig & { readonly imageSizes: readonly import('./media-config.js').ImageSize[] } {
  return storage !== undefined &&
    isImageFile(mimeType) &&
    uploadConfig?.imageSizes !== undefined &&
    uploadConfig.imageSizes.length > 0
}

async function writeMainFile (
  storage: StorageAdapter | undefined,
  resolvedDir: string,
  storedName: string,
  data: Buffer
): Promise<CmsError | null> {
  if (storage) {
    const writeResult = await storage.write(storedName, data)
    return writeResult.isErr() ? writeResult.error : null
  }

  const storedPath = resolve(join(resolvedDir, storedName))
  if (!storedPath.startsWith(resolvedDir)) {
    return { code: CmsErrorCode.FORBIDDEN, message: 'Forbidden' }
  }

  const writeResult = await ResultAsync.fromPromise(
    writeFile(storedPath, data),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INTERNAL,
      message: e instanceof Error ? e.message : 'File write failed'
    })
  )

  return writeResult.isErr() ? writeResult.error : null
}

function buildUploadResult (
  originalName: string,
  storedName: string,
  mimeType: string,
  filesize: number,
  focalX: number | undefined,
  focalY: number | undefined,
  sizes: Record<string, SizeMetadata> | undefined
): UploadResult {
  return {
    filename: originalName,
    storedPath: storedName,
    mimeType,
    filesize,
    ...(focalX !== undefined && focalY !== undefined ? { focalX, focalY } : {}),
    ...(sizes ? { sizes } : {})
  }
}

export function createUploadHandler (
  uploadDir: string,
  storage?: StorageAdapter,
  uploadConfig?: UploadConfig
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const resolvedDir = resolve(uploadDir)

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const filenameHeader = req.headers['x-filename']
    const rawName = Array.isArray(filenameHeader) ? filenameHeader[0] ?? 'upload' : filenameHeader ?? 'upload'
    const originalName = basename(rawName)
    if (!SAFE_FILENAME_RE.test(originalName)) {
      sendError(res, 400, 'Invalid filename')
      return
    }

    const bodyResult = await readRawBody(req, MAX_UPLOAD_BYTES)
    if (bodyResult.isErr()) {
      sendError(res, 400, bodyResult.error.message)
      return
    }

    const data = bodyResult.value
    const storedName = generateStoredName(originalName)
    const mimeType = getMimeType(originalName)

    const writeError = await writeMainFile(storage, resolvedDir, storedName, data)
    if (writeError) {
      const status = writeError.code === CmsErrorCode.FORBIDDEN ? 403 : 500
      sendError(res, status, writeError.message)
      return
    }

    let focalX: number | undefined
    let focalY: number | undefined
    let sizes: Record<string, SizeMetadata> | undefined

    if (isImageFile(mimeType) && uploadConfig?.focalPoint) {
      const fp = parseFocalPoint(req)
      if (fp) {
        focalX = fp.x
        focalY = fp.y
      }
    }

    if (hasImageSizes(storage, mimeType, uploadConfig)) {
      const focalPoint = (focalX !== undefined && focalY !== undefined)
        ? { x: focalX, y: focalY }
        : undefined
      const formats = uploadConfig.formats ?? []
      const processResult = await processImageSizes(data, uploadConfig.imageSizes, formats, focalPoint)
      if (processResult.isErr()) {
        sendError(res, 500, processResult.error.message)
        return
      }

      const processed = processResult.value
      const originalExt = originalName.split('.').pop() ?? ''
      sizes = buildSizeMetadata(processed, originalExt)

      // storage is guaranteed non-undefined by hasImageSizes guard
      await writeVariants(storage!, storedName, processed)
    }

    const result = buildUploadResult(originalName, storedName, mimeType, data.length, focalX, focalY, sizes)
    sendJson(res, 201, result)
  }
}
