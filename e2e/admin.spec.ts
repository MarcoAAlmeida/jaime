import { expect, test } from '@playwright/test'

// add-admin-console — the OAUTH_E2E stub signs in with a canned,
// query-parameterisable profile. `isOperator` matches the GitHub login
// `MarcoAAlmeida` (case-insensitive) or the operator email. The local
// D1 is stateful across runs, so the toggle target is a fresh identity
// each run.

const OPERATOR = '/auth/github?e2e=1&next=/admin&e2e_id=555001'
  + '&e2e_login=MarcoAAlmeida&e2e_email=e2e-operator@example.com'

test('the operator sees the roster and can grant @jah access', async ({ browser }) => {
  test.setTimeout(120_000)

  const stamp = Date.now()
  const email = `e2e-rando-${stamp}@example.com`
  const rando = await (await browser.newContext()).newPage()
  await rando.goto(`/auth/github?e2e=1&next=/account&e2e_id=${stamp}`
    + `&e2e_login=rando${stamp}&e2e_email=${encodeURIComponent(email)}`)
  await rando.waitForURL(/\/account/)

  const op = await (await browser.newContext()).newPage()
  await op.goto(OPERATOR)
  await op.waitForURL(/\/admin/)
  await expect(op.getByTestId('admin-accounts')).toBeVisible()

  const row = () => op.locator(`[data-testid="admin-account-row"][data-email="${email}"]`)
  await expect(row()).toBeVisible()
  const sw = () => row().getByTestId('admin-access-switch')
  await expect(sw()).toHaveAttribute('aria-checked', 'false')

  await sw().click()
  await expect(sw()).toHaveAttribute('aria-checked', 'true')

  // The grant persists across a reload (it was a real write).
  await op.reload()
  await expect(sw()).toHaveAttribute('aria-checked', 'true')

  // The usage view renders its empty state, not an error.
  await expect(op.getByTestId('admin-usage-empty')).toBeVisible()
})

test('a signed-in non-operator gets the not-found page', async ({ browser }) => {
  const p = await (await browser.newContext()).newPage()
  await p.goto('/auth/github?e2e=1&next=/account&e2e_id=555002'
    + '&e2e_login=plainuser&e2e_email=e2e-plain@example.com')
  await p.waitForURL(/\/account/)

  const resp = await p.goto('/admin')
  expect(resp?.status()).toBe(404)
  await expect(p.getByTestId('admin-accounts')).toHaveCount(0)
})

test('an anonymous visitor gets the not-found page, not a sign-in redirect', async ({ page }) => {
  const resp = await page.goto('/admin')
  expect(resp?.status()).toBe(404)
  expect(page.url()).toContain('/admin')
})
