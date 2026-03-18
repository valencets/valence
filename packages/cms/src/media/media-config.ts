import type { CollectionConfig } from '../schema/collection.js'
import type { FieldConfig } from '../schema/field-types.js'

export function isUploadEnabled (collection: CollectionConfig): boolean {
  return collection.upload === true
}

export function getMediaFields (): readonly FieldConfig[] {
  return [
    { type: 'text', name: 'filename', required: true },
    { type: 'text', name: 'mimeType', required: true },
    { type: 'number', name: 'filesize', required: true },
    { type: 'text', name: 'storedPath', required: true },
    { type: 'text', name: 'altText' }
  ]
}

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  json: 'application/json',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  zip: 'application/zip'
}

export function getMimeType (filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME_MAP[ext] ?? 'application/octet-stream'
}
