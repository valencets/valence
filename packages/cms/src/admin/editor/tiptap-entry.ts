import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { SLASH_COMMANDS, filterCommands, createSlashMenu, positionMenu } from './slash-commands.js'

export interface ToolbarActionDef {
  readonly label: string
  readonly type: string
}

export const TOOLBAR_ACTIONS: readonly ToolbarActionDef[] = [
  { label: 'B', type: 'format-bold' },
  { label: 'I', type: 'format-italic' },
  { label: 'U', type: 'format-underline' },
  { label: 'H2', type: 'heading' },
  { label: 'UL', type: 'bullet-list' },
  { label: 'OL', type: 'number-list' },
  { label: 'Quote', type: 'blockquote' },
  { label: 'Code', type: 'format-code' }
]

const ACTIVE_STATE_CHECKS: Readonly<Record<string, (e: Editor) => boolean>> = {
  'format-bold': (e) => e.isActive('bold'),
  'format-italic': (e) => e.isActive('italic'),
  'format-underline': (e) => e.isActive('underline'),
  'format-code': (e) => e.isActive('code'),
  heading: (e) => e.isActive('heading', { level: 2 }),
  'bullet-list': (e) => e.isActive('bulletList'),
  'number-list': (e) => e.isActive('orderedList'),
  blockquote: (e) => e.isActive('blockquote'),
  link: (e) => e.isActive('link')
}

const ACTION_HANDLERS: Readonly<Record<string, (e: Editor) => void>> = {
  'format-bold': (e) => { e.chain().focus().toggleBold().run() },
  'format-italic': (e) => { e.chain().focus().toggleItalic().run() },
  'format-underline': (e) => { e.chain().focus().toggleUnderline().run() },
  'format-code': (e) => { e.chain().focus().toggleCode().run() },
  heading: (e) => { e.chain().focus().toggleHeading({ level: 2 }).run() },
  'bullet-list': (e) => { e.chain().focus().toggleBulletList().run() },
  'number-list': (e) => { e.chain().focus().toggleOrderedList().run() },
  blockquote: (e) => { e.chain().focus().toggleBlockquote().run() }
}

const SLASH_ACTION_HANDLERS: Readonly<Record<string, (e: Editor) => void>> = {
  'heading-2': (e) => { e.chain().focus().toggleHeading({ level: 2 }).run() },
  'heading-3': (e) => { e.chain().focus().toggleHeading({ level: 3 }).run() },
  'bullet-list': (e) => { e.chain().focus().toggleBulletList().run() },
  'ordered-list': (e) => { e.chain().focus().toggleOrderedList().run() },
  quote: (e) => { e.chain().focus().toggleBlockquote().run() },
  'code-block': (e) => { e.chain().focus().toggleCodeBlock().run() },
  divider: (e) => { e.chain().focus().setHorizontalRule().run() }
}

function updateToolbarState (editor: Editor, toolbar: HTMLElement): void {
  const buttons = toolbar.querySelectorAll<HTMLButtonElement>('.richtext-toolbar-btn')
  for (const btn of buttons) {
    const type = btn.dataset['action'] ?? ''
    const check = ACTIVE_STATE_CHECKS[type]
    const active = check ? check(editor) : false
    btn.classList.toggle('richtext-toolbar-btn--active', active)
  }
}

function createToolbar (editor: Editor): HTMLElement {
  const toolbar = document.createElement('div')
  toolbar.className = 'richtext-toolbar'

  for (const action of TOOLBAR_ACTIONS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'richtext-toolbar-btn'
    btn.textContent = action.label
    btn.dataset['action'] = action.type
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      const handler = ACTION_HANDLERS[action.type]
      if (handler) handler(editor)
    })
    toolbar.appendChild(btn)
  }

  const linkBtn = document.createElement('button')
  linkBtn.type = 'button'
  linkBtn.className = 'richtext-toolbar-btn'
  linkBtn.textContent = 'Link'
  linkBtn.dataset['action'] = 'link'
  linkBtn.addEventListener('click', (e) => {
    e.preventDefault()
    const url = prompt('Enter URL:')
    if (url && /^https?:\/\//i.test(url)) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  })
  toolbar.appendChild(linkBtn)

  return toolbar
}

function initEditor (container: HTMLElement): void {
  const fieldName = container.getAttribute('data-field')
  if (!fieldName) return

  const wrap = container.closest('.richtext-wrap')
  if (!wrap) return

  const hiddenInput = wrap.querySelector<HTMLInputElement>(`input[name="${fieldName}"]`)
  if (!hiddenInput) return

  const templateEl = wrap.querySelector<HTMLTemplateElement>('template.richtext-initial')
  const initialHtml = templateEl?.innerHTML ?? ''

  let slashQuery = ''
  let slashMenu: HTMLDivElement | null = null
  let slashFrom = -1

  function closeSlashMenu (): void {
    slashMenu?.remove()
    slashMenu = null
    slashQuery = ''
    slashFrom = -1
  }

  function openSlashMenu (x: number, y: number): void {
    closeSlashMenu()
    slashMenu = createSlashMenu(SLASH_COMMANDS, (commandId) => {
      const from = slashFrom
      const to = from + 1 + slashQuery.length
      closeSlashMenu()
      if (from >= 0) {
        editor.chain().focus().deleteRange({ from, to }).run()
      }
      const handler = SLASH_ACTION_HANDLERS[commandId]
      if (handler) handler(editor)
    })
    positionMenu(slashMenu, x, y)
    document.body.appendChild(slashMenu)
  }

  function updateSlashMenuFilter (): void {
    if (!slashMenu) return
    const filtered = filterCommands(SLASH_COMMANDS, slashQuery)
    const items = slashMenu.querySelectorAll<HTMLElement>('.slash-menu-item')
    for (const item of items) {
      const cmd = item.dataset['command'] ?? ''
      item.style.display = filtered.some(c => c.id === cmd) ? '' : 'none'
    }
  }

  function detectSlashCommand (e: Editor): void {
    const { from, empty } = e.state.selection
    if (!empty) { closeSlashMenu(); return }

    const $pos = e.state.doc.resolve(from)
    const textBefore = $pos.parent.textBetween(0, $pos.parentOffset)

    const lastSlash = textBefore.lastIndexOf('/')
    if (lastSlash === -1) { closeSlashMenu(); return }

    const query = textBefore.slice(lastSlash + 1)
    if (query.includes(' ')) { closeSlashMenu(); return }

    slashQuery = query
    slashFrom = $pos.start() + lastSlash

    const coords = e.view.coordsAtPos(from)
    if (!slashMenu) {
      openSlashMenu(coords.left, coords.bottom + 4)
    }
    updateSlashMenuFilter()
  }

  const editor = new Editor({
    element: container,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] }
      }),
      Underline,
      Link.configure({ openOnClick: false })
    ],
    content: initialHtml,
    onUpdate: ({ editor: e }) => {
      hiddenInput.value = e.getHTML()
      detectSlashCommand(e)
    }
  })

  const toolbar = createToolbar(editor)
  container.parentElement?.insertBefore(toolbar, container)

  // Register toolbar state sync after toolbar exists
  editor.on('transaction', ({ editor: e }) => {
    updateToolbarState(e, toolbar)
  })

  // Handle Escape to close slash menu
  editor.view.dom.addEventListener('keydown', (e: Event) => {
    const ke = e as KeyboardEvent
    if (ke.key === 'Escape' && slashMenu) {
      closeSlashMenu()
      ke.preventDefault()
    }
  })

  // Close slash menu on outside clicks
  document.addEventListener('click', (e: MouseEvent) => {
    if (slashMenu && !slashMenu.contains(e.target as Node)) {
      closeSlashMenu()
    }
  }, { capture: true })
}

export function initAllEditors (): void {
  const editors = document.querySelectorAll<HTMLElement>('.richtext-editor')
  for (const el of editors) {
    initEditor(el)
  }
}
