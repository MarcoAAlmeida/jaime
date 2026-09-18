import { expect, test } from '@playwright/test'

// docs-shell — Reference-only content now (add-articles moved
// Explanation-type pages out to /articles); the ASCII Art page is the
// nav's real content page.

test('the ASCII Art doc is listed and renders', async ({ page }) => {
  await page.goto('/docs')
  await expect(page).toHaveTitle(/Docs/)

  const nav = page.getByRole('navigation')
  await expect(nav.getByRole('link', { name: 'ASCII Art' })).toBeVisible()

  await nav.getByRole('link', { name: 'ASCII Art' }).click()
  await expect(page).toHaveURL(/\/docs\/ascii-art$/)
  await expect(page.getByRole('heading', { name: 'Site structure' })).toBeVisible()
})

test('an ASCII Art doc links through to the tool surface', async ({ page }) => {
  await page.goto('/docs/ascii-art')
  await page.getByRole('link', { name: 'Composition Room' }).first().click()
  await expect(page).toHaveURL(/\/app\/composition/)
})
