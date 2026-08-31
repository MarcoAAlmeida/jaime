import { expect, test } from '@playwright/test'

// docs-shell — the Strudel section is a real nested topic tree
// (add-content-authoring), and its pages link into the tool surface.

test('the Strudel docs section is nested and its pages render', async ({ page }) => {
  await page.goto('/docs/strudel')
  await expect(page).toHaveTitle(/Strudel/)

  // The sidebar lists the sub-pages nested under Strudel.
  const nav = page.getByRole('navigation')
  await expect(nav.getByRole('link', { name: 'Mini-notation' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Effects' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Strudel in JAM' })).toBeVisible()

  await nav.getByRole('link', { name: 'Mini-notation' }).click()
  await expect(page).toHaveURL(/\/docs\/strudel\/mini-notation$/)
  await expect(page.getByRole('heading', { name: 'Euclidean rhythms' })).toBeVisible()
})

test('a Strudel doc links through to the pattern library', async ({ page }) => {
  await page.goto('/docs/strudel/mini-notation')
  await page.getByRole('link', { name: 'pattern library' }).first().click()
  await expect(page).toHaveURL(/\/app\/patterns$/)
})

test('the auth-gated doc still gates for an anonymous visitor', async ({ page }) => {
  await page.goto('/docs/behind-the-scenes')
  await expect(page.getByTestId('doc-locked')).toBeVisible()
  expect(await page.content()).not.toContain('no passwords are stored')
})
