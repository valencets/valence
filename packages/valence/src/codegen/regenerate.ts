import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { ResultAsync } from 'neverthrow'
import type { CollectionConfig } from '@valencets/cms'
import { generateEntityInterface } from './type-generator.js'
import { generateApiClient } from './api-client-generator.js'
import { generateBaseClient } from './base-client-generator.js'

interface RegenResult {
  readonly added: readonly string[]
  readonly updated: readonly string[]
  readonly skipped: readonly string[]
}

interface ScaffoldError {
  readonly message: string
}

const GENERATED_MARKER = '// @generated'

async function isGenerated (filePath: string): Promise<boolean> {
  if (!existsSync(filePath)) return false
  const fileContent = await readFile(filePath, 'utf-8')
  return typeof fileContent === 'string' && fileContent.startsWith(GENERATED_MARKER)
}

async function writeIfGenerated (
  filePath: string,
  content: string,
  tracker: { added: string[]; updated: string[]; skipped: string[] }
): Promise<void> {
  if (existsSync(filePath)) {
    const generated = await isGenerated(filePath)
    if (!generated) {
      tracker.skipped.push(filePath)
      return
    }
    await writeFile(filePath, content)
    tracker.updated.push(filePath)
  } else {
    await writeFile(filePath, content)
    tracker.added.push(filePath)
  }
}

export function regenerateFromConfig (
  projectDir: string,
  collections: readonly CollectionConfig[]
): ResultAsync<RegenResult, ScaffoldError> {
  return ResultAsync.fromPromise(
    (async (): Promise<RegenResult> => {
      const srcDir = join(projectDir, 'src')
      const tracker = { added: [] as string[], updated: [] as string[], skipped: [] as string[] }

      // Regenerate entity slices for non-auth collections
      const entityCollections = collections.filter(c => !c.auth)
      for (const col of entityCollections) {
        const entityDir = join(srcDir, 'entities', col.slug)
        await mkdir(join(entityDir, 'model'), { recursive: true })
        await mkdir(join(entityDir, 'api'), { recursive: true })

        const typesPath = join(entityDir, 'model', 'types.ts')
        await writeIfGenerated(typesPath, generateEntityInterface(col), tracker)

        const clientPath = join(entityDir, 'api', 'client.ts')
        await writeIfGenerated(clientPath, generateApiClient(col), tracker)
      }

      // Regenerate shared base client
      await mkdir(join(srcDir, 'shared', 'api'), { recursive: true })
      const baseClientPath = join(srcDir, 'shared', 'api', 'base-client.ts')
      await writeIfGenerated(baseClientPath, generateBaseClient(), tracker)

      return {
        added: tracker.added,
        updated: tracker.updated,
        skipped: tracker.skipped
      }
    })(),
    (e): ScaffoldError => ({ message: e instanceof Error ? e.message : 'regeneration failed' })
  )
}
