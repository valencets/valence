import { createEditor, $getRoot, $getSelection, $isRangeSelection, $insertNodes, FORMAT_TEXT_COMMAND, type LexicalEditor, type ElementNode } from 'lexical'
import { registerRichText, HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode, registerList, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list'
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { registerHistory, createEmptyHistoryState } from '@lexical/history'
import { $setBlocksType } from '@lexical/selection'

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

function setBlockType (editor: LexicalEditor, createNode: () => ElementNode): void {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      $setBlocksType(selection, createNode)
    }
  })
}

const ACTION_HANDLERS: Readonly<Record<string, (editor: LexicalEditor) => void>> = {
  'format-bold': (e) => e.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'),
  'format-italic': (e) => e.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'),
  'format-underline': (e) => e.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'),
  'format-code': (e) => e.dispatchCommand(FORMAT_TEXT_COMMAND, 'code'),
  heading: (e) => setBlockType(e, () => $createHeadingNode('h2')),
  'bullet-list': (e) => e.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
  'number-list': (e) => e.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
  blockquote: (e) => setBlockType(e, () => $createQuoteNode())
}

function dispatchAction (editor: LexicalEditor, action: ToolbarActionDef): void {
  const handler = ACTION_HANDLERS[action.type]
  if (handler) handler(editor)
}

function createToolbar (editor: LexicalEditor): HTMLElement {
  const toolbar = document.createElement('div')
  toolbar.className = 'richtext-toolbar'

  for (const action of TOOLBAR_ACTIONS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'richtext-toolbar-btn'
    btn.textContent = action.label
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      dispatchAction(editor, action)
    })
    toolbar.appendChild(btn)
  }

  // Link button is special — needs URL prompt
  const linkBtn = document.createElement('button')
  linkBtn.type = 'button'
  linkBtn.className = 'richtext-toolbar-btn'
  linkBtn.textContent = 'Link'
  linkBtn.addEventListener('click', (e) => {
    e.preventDefault()
    const url = prompt('Enter URL:')
    if (url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
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

  const config = {
    namespace: `richtext-${fieldName}`,
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
    onError: (error: Error) => { console.error('Lexical error:', error) },
    theme: {
      paragraph: 'richtext-p',
      heading: {
        h2: 'richtext-h2',
        h3: 'richtext-h3'
      },
      text: {
        bold: 'richtext-bold',
        italic: 'richtext-italic',
        underline: 'richtext-underline',
        code: 'richtext-code'
      },
      list: {
        ul: 'richtext-ul',
        ol: 'richtext-ol',
        listitem: 'richtext-li'
      },
      quote: 'richtext-quote',
      link: 'richtext-link'
    }
  }

  const editor = createEditor(config)

  const toolbar = createToolbar(editor)
  container.parentElement?.insertBefore(toolbar, container)

  const contentEditable = document.createElement('div')
  contentEditable.contentEditable = 'true'
  contentEditable.className = 'richtext-content'
  container.appendChild(contentEditable)

  editor.setRootElement(contentEditable)
  registerRichText(editor)
  registerList(editor)
  registerHistory(editor, createEmptyHistoryState(), 300)

  // Load initial HTML content
  if (initialHtml) {
    editor.update(() => {
      const parser = new DOMParser()
      const dom = parser.parseFromString(initialHtml, 'text/html')
      const nodes = $generateNodesFromDOM(editor, dom)
      const root = $getRoot()
      root.clear()
      $insertNodes(nodes)
    })
  }

  // Sync editor state to hidden input on every change
  editor.registerUpdateListener(({ editorState }) => {
    editorState.read(() => {
      const html = $generateHtmlFromNodes(editor)
      hiddenInput.value = html
    })
  })
}

export function initAllEditors (): void {
  const editors = document.querySelectorAll<HTMLElement>('.richtext-editor')
  for (const el of editors) {
    initEditor(el)
  }
}
