import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { ResultAsync } from '@valencets/resultkit'
import type { CollectionConfig } from '@valencets/cms'
import { store as validateStore, generateStoreModule } from '@valencets/store'
import type { StoreInput } from '@valencets/store'
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

/**
 * Boot-time and watch-time entry: regenerate everything the config implies
 * and narrate the result. A fresh checkout gets working generated modules
 * before the first request, not after the first config edit.
 */
export async function ensureGeneratedModules (
  projectDir: string,
  collections: readonly CollectionConfig[],
  stores: readonly StoreInput[] | undefined,
  log: (msg: string) => void
): Promise<void> {
  await regenerateFromConfig(projectDir, collections, stores).match(
    (result) => {
      const total = result.added.length + result.updated.length
      if (total > 0) log(`Generated ${total} file(s). Skipped ${result.skipped.length} user-edited.`)
    },
    (e) => { log(`Code generation error: ${e.message}`) }
  )
}

export function regenerateFromConfig (
  projectDir: string,
  collections: readonly CollectionConfig[],
  stores?: readonly StoreInput[]
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

      // Regenerate typed store modules — invalid definitions are skipped
      // here exactly as the route wiring skips them at serve time.
      const validStores = (stores ?? []).flatMap(input => {
        const result = validateStore(input)
        return result.isOk() ? [result.value] : []
      })
      if (validStores.length > 0) {
        await mkdir(join(srcDir, 'shared', 'stores'), { recursive: true })
        for (const storeConfig of validStores) {
          const modulePath = join(srcDir, 'shared', 'stores', `${storeConfig.slug}.ts`)
          await writeIfGenerated(modulePath, generateStoreModule(storeConfig), tracker)
        }
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
