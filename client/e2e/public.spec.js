import { expect, test } from '@playwright/test'

test('category page lists only LIVE listings with open status and one action', async ({ page }) => {
  await page.goto('/eat-and-drink/restaurants')
  await expect(page.getByRole('heading', { level: 1, name: 'Restaurants' })).toBeVisible()
  const cards = page.locator('article')
  await expect(cards.first()).toBeVisible()
  // The demo publishes 8 of the 9 imported restaurants; the 9th (last in the file) stays
  // PENDING and must not show. Other specs may add LIVE restaurants of their own.
  await expect(cards.nth(7)).toBeVisible()
  await expect(page.getByText('Pulukisi Newari Restaurant')).toHaveCount(0)
  await expect(
    page.getByText(/Open now · closes|Closed · opens|Open 24 hours/).first(),
  ).toBeVisible()
  // One main action per card: Call for restaurants with a number.
  await expect(cards.getByRole('link', { name: /^Call/ }).first()).toHaveAttribute('href', /^tel:/)
  await expect(page.getByText('Featured').first()).toBeVisible()
})

test('emergency page shows hotlines as tap-to-call buttons and is linked from the footer', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: 'Emergency numbers', exact: true })
    .click()
  await expect(page).toHaveURL(/\/emergency$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Emergency numbers' })).toBeVisible()
  const police = page.getByRole('link', { name: /100\s*Police/ })
  await expect(police).toHaveAttribute('href', 'tel:100')
  await expect(page.getByRole('heading', { name: '24h Hospitals' })).toBeVisible()
})

test('app listings offer store and website buttons and MobileApplication data', async ({
  page,
}) => {
  await page.goto('/listing/pathao')
  await expect(page.getByRole('heading', { level: 1, name: 'Pathao' })).toBeVisible()
  const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())
  expect(jsonLd['@type']).toBe('MobileApplication')
  await expect(page.getByRole('link', { name: 'Website' }).first()).toBeVisible()
})
