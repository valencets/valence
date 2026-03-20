import { type Locator, type Page } from '@playwright/test'

export class ListPage {
  readonly heading: Locator
  readonly rows: Locator
  readonly createButton: Locator
  readonly searchInput: Locator
  readonly toast: Locator
  readonly toastMessage: Locator

  constructor (private readonly page: Page) {
    this.heading = page.locator('h1')
    this.rows = page.locator('table tbody tr')
    this.createButton = page.locator('.list-header a.btn-primary')
    this.searchInput = page.locator('input[type="search"][name="q"]')
    this.toast = page.locator('.toast')
    this.toastMessage = page.locator('.toast-message')
  }

  async goto (collection: string): Promise<void> {
    await this.page.goto(`/admin/${collection}`)
  }

  async getRowCount (): Promise<number> {
    return this.rows.count()
  }

  async clickCreate (): Promise<void> {
    await this.createButton.click()
  }

  async getRowText (index: number): Promise<string> {
    const row = this.rows.nth(index)
    return row.textContent() ?? ''
  }

  async clickEditOnRow (index: number): Promise<void> {
    const row = this.rows.nth(index)
    await row.locator('.actions-cell .action-link').click()
  }
}
