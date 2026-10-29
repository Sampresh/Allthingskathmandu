import { expect, test } from '@playwright/test'
import { login } from './helpers.js'

test('moderators can read listings but not change them', async ({ page }) => {
  await login(page, 'moderator')
  await page.goto('/admin/listings')
  await expect(page.getByRole('tab', { name: /Pending/ })).toBeVisible()
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'New listing' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Import CSV' })).toHaveCount(0)
  await expect(page.getByLabel('Select all shown listings')).toHaveCount(0)

  await page.locator('tbody tr a').first().click()
  await expect(page.getByRole('heading', { name: 'Basics' })).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0)
})

test('members cannot open the admin area', async ({ page }) => {
  await login(page, 'member')
  await page.goto('/admin/listings')
  await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
  await expect(page.locator('table')).toHaveCount(0)
})
