import { ValAutosave } from './val-autosave.js'
import { ValBadge } from './val-badge.js'
import { ValBulkBar } from './val-bulk-bar.js'
import { ValButton } from './val-button.js'
import { ValCard } from './val-card.js'
import { ValCheckbox } from './val-checkbox.js'
import { ValDialog } from './val-dialog.js'
import { ValForm } from './val-form.js'
import { ValGrid } from './val-grid.js'
import { ValHeading } from './val-heading.js'
import { ValInput } from './val-input.js'
import { ValNav } from './val-nav.js'
import { ValPreviewPane } from './val-preview-pane.js'
import { ValSection } from './val-section.js'
import { ValSelect } from './val-select.js'
import { ValSidebar } from './val-sidebar.js'
import { ValSpinner } from './val-spinner.js'
import { ValStack } from './val-stack.js'
import { ValTable } from './val-table.js'
import { ValTabs } from './val-tabs.js'
import { ValText } from './val-text.js'
import { ValTextarea } from './val-textarea.js'
import { ValToggle } from './val-toggle.js'

export const COMPONENT_REGISTRY: Readonly<Record<string, CustomElementConstructor>> = {
  'val-autosave': ValAutosave,
  'val-badge': ValBadge,
  'val-bulk-bar': ValBulkBar,
  'val-button': ValButton,
  'val-card': ValCard,
  'val-checkbox': ValCheckbox,
  'val-dialog': ValDialog,
  'val-form': ValForm,
  'val-grid': ValGrid,
  'val-heading': ValHeading,
  'val-input': ValInput,
  'val-nav': ValNav,
  'val-preview-pane': ValPreviewPane,
  'val-section': ValSection,
  'val-select': ValSelect,
  'val-sidebar': ValSidebar,
  'val-spinner': ValSpinner,
  'val-stack': ValStack,
  'val-table': ValTable,
  'val-tabs': ValTabs,
  'val-text': ValText,
  'val-textarea': ValTextarea,
  'val-toggle': ValToggle
}

export function registerAll (): void {
  for (const [tag, ctor] of Object.entries(COMPONENT_REGISTRY)) {
    if (customElements.get(tag) === undefined) {
      customElements.define(tag, ctor)
    }
  }
}
