export function initMobileTabs (): void {
  const container = document.querySelector('.mobile-comparison') as HTMLElement | null
  if (!container) return

  const tabs = container.querySelectorAll('.mobile-tab')
  const panels = container.querySelectorAll('.mobile-panel')

  container.addEventListener('click', (e: Event) => {
    const target = (e.target as Element).closest('.mobile-tab') as HTMLElement | null
    if (!target) return

    const tabKey = target.dataset.tab
    if (!tabKey) return

    for (const tab of tabs) {
      tab.classList.remove('active')
    }
    target.classList.add('active')

    for (const panel of panels) {
      if ((panel as HTMLElement).dataset.panel === tabKey) {
        panel.classList.add('active')
      } else {
        panel.classList.remove('active')
      }
    }
  })
}
