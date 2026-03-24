import { fromThrowable } from '@valencets/resultkit'
interface BlockFieldDef {
  readonly type: string
  readonly name: string
}

interface BlockDef {
  readonly slug: string
  readonly fields: readonly BlockFieldDef[]
  readonly labels?: { readonly singular?: string; readonly plural?: string }
}

interface BlockEntry {
  blockType: string
  [key: string]: string
}

function serializeBlocks (container: HTMLElement): void {
  const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')
  if (!hidden) return
  const items = container.querySelectorAll<HTMLElement>('.blocks-item')
  const blocks: Array<BlockEntry> = []
  for (const item of items) {
    const blockType = item.getAttribute('data-block-type') ?? ''
    const entry: BlockEntry = { blockType }
    const inputs = item.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input:not([type="hidden"]), textarea, select')
    for (const input of inputs) {
      if (input.name) {
        entry[input.name] = input.value
      }
    }
    blocks.push(entry)
  }
  hidden.value = JSON.stringify(blocks)
}

function createBlockFieldset (blockDef: BlockDef, index: number, container: HTMLElement): HTMLElement {
  const fieldset = document.createElement('fieldset')
  fieldset.className = 'blocks-item'
  fieldset.setAttribute('data-block-index', String(index))
  fieldset.setAttribute('data-block-type', blockDef.slug)

  const legend = document.createElement('legend')
  legend.textContent = blockDef.labels?.singular ?? blockDef.slug
  fieldset.appendChild(legend)

  for (const f of blockDef.fields) {
    const label = document.createElement('label')
    label.className = 'form-field'
    const span = document.createElement('span')
    span.textContent = f.name
    label.appendChild(span)
    const input = document.createElement('input')
    input.className = 'form-input'
    input.type = 'text'
    input.name = f.name
    input.value = ''
    label.appendChild(input)
    fieldset.appendChild(label)

    input.addEventListener('input', () => serializeBlocks(container))
  }

  const removeBtn = document.createElement('button')
  removeBtn.type = 'button'
  removeBtn.className = 'blocks-remove'
  removeBtn.textContent = 'Remove'
  removeBtn.addEventListener('click', () => {
    fieldset.remove()
    serializeBlocks(container)
  })
  fieldset.appendChild(removeBtn)

  return fieldset
}

/** JSON parse boundary using fromThrowable — single safeJsonParse equivalent. */
const safeBlocksJsonParse = fromThrowable(JSON.parse, () => null)

export function initBlocksFields (): void {
  const containers = document.querySelectorAll<HTMLElement>('.blocks-field')
  for (const container of containers) {
    const configAttr = container.getAttribute('data-blocks-config')
    if (!configAttr) continue
    let blockDefs: BlockDef[] = []
    const parseResult = safeBlocksJsonParse(configAttr)
    if (parseResult.isErr() || parseResult.value === null) continue
    blockDefs = parseResult.value as BlockDef[]

    const addSection = container.querySelector('.blocks-add')
    const select = container.querySelector<HTMLSelectElement>('.blocks-type-select')
    const addBtn = container.querySelector<HTMLButtonElement>('.blocks-add-btn')

    // Wire existing remove buttons
    const existingRemoves = container.querySelectorAll<HTMLButtonElement>('.blocks-remove')
    for (const btn of existingRemoves) {
      btn.addEventListener('click', () => {
        const item = btn.closest('.blocks-item')
        if (item) {
          item.remove()
          serializeBlocks(container)
        }
      })
    }

    // Wire existing field inputs
    const existingInputs = container.querySelectorAll<HTMLInputElement>('.blocks-item input:not([type="hidden"])')
    for (const input of existingInputs) {
      input.addEventListener('input', () => serializeBlocks(container))
    }

    if (!addBtn || !select || !addSection) continue

    addBtn.addEventListener('click', () => {
      const selectedSlug = select.value
      const def = blockDefs.find(b => b.slug === selectedSlug)
      if (!def) return
      const items = container.querySelectorAll('.blocks-item')
      const fieldset = createBlockFieldset(def, items.length, container)
      container.insertBefore(fieldset, addSection)
      serializeBlocks(container)
    })
  }
}
