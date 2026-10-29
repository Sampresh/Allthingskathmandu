import { expect, test } from '@playwright/test'
import { eventually, login, toast, visit } from './helpers.js'

const CATEGORY = '/eat-and-drink/restaurants'

test('create → publish → on category and detail pages; Trash → gone; restore → back', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const name = `E2E Momo Corner ${Date.now() % 100000}`
  await login(page, 'admin')

  // Create a draft, then publish once the rules pass.
  await page.goto('/admin/listings/new')
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Primary category').selectOption({ label: 'Restaurants' })
  await page
    .getByLabel('One-line description (on cards)')
    .fill('Jhol momo and laphing by the stupa')
  await page.getByLabel('Phone', { exact: true }).fill('+9779800000001')
  await page.getByLabel('Area', { exact: true }).selectOption({ label: 'Thamel' })
  await page.getByLabel('Latitude').fill('27.7149')
  await page.getByLabel('Longitude').fill('85.3109')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await page.waitForURL(/\/admin\/listings\/[0-9a-f-]{36}$/)
  await toast(page, 'Saved')

  await page.getByRole('button', { name: 'Publish' }).click()
  await toast(page, 'Not ready to publish yet')
  await expect(page.getByText('Confirm the phone number').first()).toBeVisible()
  await page.getByLabel('Phone number confirmed with the business').check()
  await page.getByRole('button', { name: 'Publish' }).click()
  await toast(page, 'Published')
  const slug = await page.getByLabel('Web address').inputValue()
  expect(slug).toMatch(/^e2e-momo-corner-\d+$/)

  // Public pages update within seconds of the save.
  const card = (p) =>
    expect(p.getByRole('link', { name, exact: true })).toBeVisible({ timeout: 2000 })
  await eventually(page, CATEGORY, card)
  await visit(page, `/listing/${slug}`)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByText('Jhol momo and laphing by the stupa').first()).toBeVisible()
  const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())
  expect(jsonLd).toMatchObject({ '@type': 'LocalBusiness', name, telephone: '+9779800000001' })
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /opengraph-image/,
  )

  // Move to Trash: the listing leaves the public site.
  await visit(page, `/admin/listings?q=${encodeURIComponent(name)}`)
  await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Move to Trash' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Move to Trash' }).click()
  await toast(page, 'moved to Trash')
  await eventually(page, `/listing/${slug}`, (p) =>
    expect(p.getByRole('heading', { level: 1, name })).toHaveCount(0, { timeout: 1000 }),
  )
  await eventually(page, CATEGORY, (p) =>
    expect(p.getByRole('link', { name, exact: true })).toHaveCount(0, { timeout: 1000 }),
  )

  // Restore: it comes back.
  await visit(page, `/admin/listings?status=TRASH&q=${encodeURIComponent(name)}`)
  await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Restore' }).click()
  await toast(page, 'restored')
  await eventually(page, `/listing/${slug}`, (p) =>
    expect(p.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 1000 }),
  )
})
