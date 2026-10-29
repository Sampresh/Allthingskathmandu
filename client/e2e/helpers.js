import { expect } from '@playwright/test'

// Users created by server/tests/e2e/prepare.js in the e2e database (throwaway test values).
export const PASSWORD = 'E2e-Test-Passw0rd!'
export const USERS = {
  admin: 'e2e-admin@atk.test',
  moderator: 'e2e-mod@atk.test',
  member: 'e2e-member@atk.test',
}

/** Logs in through the staff (admin) or public login page. */
export async function login(page, who) {
  const staff = who !== 'member'
  await page.goto(staff ? '/admin/login' : '/login')
  await page.getByLabel('Email').fill(USERS[who])
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /log in/i }).click()
  if (staff) await page.waitForURL('**/admin')
  else await expect(page).not.toHaveURL(/\/login/)
}

export const toast = (page, text) =>
  expect(page.getByRole('status').getByText(text).first()).toBeVisible()

/**
 * Loads a page and waits for its requests to finish. Every full page load refreshes the
 * session (the refresh token rotates); leaving a page mid-refresh would leave the browser
 * holding the old token, which the API treats as reuse and logs everyone out.
 */
export async function visit(page, path) {
  await page.goto(path)
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
}

/**
 * Reloads `path` until `check(page)` passes: saves reach public pages through the worker
 * (cache purge and page revalidation) within seconds.
 */
export async function eventually(page, path, check, timeout = 30_000) {
  await expect
    .poll(
      async () => {
        await visit(page, path)
        try {
          await check(page)
          return true
        } catch {
          return false
        }
      },
      { timeout, intervals: [500, 1000, 2000] },
    )
    .toBe(true)
}
