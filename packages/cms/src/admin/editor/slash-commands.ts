export interface SlashCommand {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly icon?: string | undefined
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { id: 'heading-2', label: 'Heading 2', description: 'Large section heading' },
  { id: 'heading-3', label: 'Heading 3', description: 'Medium section heading' },
  { id: 'bullet-list', label: 'Bullet List', description: 'Unordered list' },
  { id: 'ordered-list', label: 'Ordered List', description: 'Numbered list' },
  { id: 'quote', label: 'Quote', description: 'Blockquote' },
  { id: 'code-block', label: 'Code Block', description: 'Preformatted code' },
  { id: 'divider', label: 'Divider', description: 'Horizontal rule' }
]

export function filterCommands (commands: readonly SlashCommand[], query: string): readonly SlashCommand[] {
  if (!query) return commands
  const lower = query.toLowerCase()
  return commands.filter(c =>
    c.label.toLowerCase().includes(lower) ||
    c.description.toLowerCase().includes(lower)
  )
}

export function createSlashMenu (
  commands: readonly SlashCommand[],
  onSelect: (commandId: string) => void
): HTMLDivElement {
  const menu = document.createElement('div')
  menu.className = 'slash-menu'

  for (const cmd of commands) {
    const item = document.createElement('div')
    item.className = 'slash-menu-item'
    item.dataset['command'] = cmd.id
    item.setAttribute('role', 'option')
    item.setAttribute('tabindex', '-1')

    const labelEl = document.createElement('span')
    labelEl.className = 'slash-menu-label'
    labelEl.textContent = cmd.label

    const descEl = document.createElement('span')
    descEl.className = 'slash-menu-desc'
    descEl.textContent = cmd.description

    item.appendChild(labelEl)
    item.appendChild(descEl)
    item.addEventListener('click', () => { onSelect(cmd.id) })
    menu.appendChild(item)
  }

  return menu
}

/** Positions the slash menu below the given coordinates. */
export function positionMenu (menu: HTMLElement, x: number, y: number): void {
  menu.style.position = 'fixed'
  menu.style.left = `${x}px`
  menu.style.top = `${y}px`
  menu.style.zIndex = '9999'
}

/** Updates the slash menu contents with filtered commands. */
export function updateMenuItems (
  menu: HTMLElement,
  commands: readonly SlashCommand[],
  onSelect: (commandId: string) => void
): void {
  menu.innerHTML = ''
  const filtered = filterCommands(commands, '')
  for (const cmd of filtered) {
    const item = document.createElement('div')
    item.className = 'slash-menu-item'
    item.dataset['command'] = cmd.id
    item.setAttribute('role', 'option')
    item.textContent = cmd.label
    item.addEventListener('click', () => { onSelect(cmd.id) })
    menu.appendChild(item)
  }
}
