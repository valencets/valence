function getCheckedCount (): number {
  return document.querySelectorAll<HTMLInputElement>('.bulk-row-check:checked').length
}

function updateBar (): void {
  const count = getCheckedCount()
  const countEl = document.querySelector<HTMLElement>('.bulk-count')
  const bar = document.querySelector<HTMLElement>('.bulk-action-bar')
  if (countEl) countEl.textContent = `${count} selected`
  if (bar) bar.style.display = count > 0 ? '' : 'none'
}

export function initBulkActions (): void {
  const selectAll = document.querySelector<HTMLInputElement>('.bulk-select-all')
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      const rows = document.querySelectorAll<HTMLInputElement>('.bulk-row-check')
      for (const row of rows) {
        row.checked = selectAll.checked
      }
      updateBar()
    })
  }

  document.addEventListener('change', (e) => {
    const target = e.target
    if (target instanceof HTMLInputElement && target.classList.contains('bulk-row-check')) {
      updateBar()
    }
  })
}
