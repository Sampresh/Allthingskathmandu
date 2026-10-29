import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { login } from './helpers.js'

const CSV = fileURLToPath(new URL('../../server/prisma/data/listings.csv', import.meta.url))

test('import dry run reports every row of the data file without errors', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/admin/listings/import')
  await page.getByLabel('Choose a CSV file').setInputFiles(CSV)
  await expect(page.getByText('listings.csv')).toBeVisible()
  await page.getByRole('button', { name: 'Dry run' }).click()

  const stat = (label) => page.locator('dl > div').filter({ hasText: label }).locator('dd')
  await expect(stat('Rows')).toHaveText('328')
  await expect(stat('Errors')).toHaveText('0')
  // The e2e database was filled from the same file, so nothing is new or changed.
  await expect(stat('New')).toHaveText('0')
  await expect(page.getByRole('cell', { name: 'Jasper Restaurant' })).toBeVisible()
  await page.getByRole('button', { name: 'Errors' }).click()
  await expect(page.getByText('No rows here.')).toBeVisible()
})
