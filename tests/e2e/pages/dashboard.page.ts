import { type Locator, type Page } from '@playwright/test'

export class DashboardPage {
  readonly heading: Locator
  readonly collectionCards: Locator

  constructor (private readonly page: Page) {
    this.heading = page.locator('h1')
    this.collectionCards = page.locator('.collection-card, .stat-card, [class*="card"]')
  }

  async goto (): Promise<void> {
    await this.page.goto('/admin')
  }

  async getCollectionLink (name: string): Promise<Locator> {
    return this.page.getByRole('link', { name })
  }
}
