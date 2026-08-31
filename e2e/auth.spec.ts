import { expect, test } from '@playwright/test'

// user-account + identity + docs-shell deltas. The webServer runs with
// AUTH_E2E=1 so /api/auth/request returns the magic link in `devLink`.

async function signIn(page: import('@playwright/test').Page, email: string, name?: string) {
  await page.goto('/signup')
  await page.locator('[data-testid="signin-email"]').fill(email)
  if (name) await page.locator('[data-testid="signin-name"]').fill(name)
  const [res] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/auth/request')),
    page.locator('[data-testid="signin-submit"]').click(),
  ])
  const { devLink } = await res.json() as { devLink: string }
  expect(devLink).toContain('/auth/callback?token=')
  await page.goto(devLink)
}

test('sign up, session survives a reload, sign out', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await signIn(page, 'newbie@example.com', 'Newbie')
  // Landed on /account (the default next when signed in from a bare /signup).
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.locator('[data-testid="account-name"]')).toHaveValue('Newbie')
  await expect(page.getByText('newbie@example.com')).toBeVisible()

  // Session persists across a fresh page (cookie-backed).
  const page2 = await ctx.newPage()
  await page2.goto('/account')
  await expect(page2).toHaveURL(/\/account$/)
  await expect(page2.getByText('newbie@example.com')).toBeVisible()

  await page2.locator('[data-testid="account-signout"]').click()
  await page2.goto('/account')
  await expect(page2).toHaveURL(/\/signup\?next=/) // bounced to sign-in

  await ctx.close()
})

test('a used magic link no longer works', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/signup')
  await page.locator('[data-testid="signin-email"]').fill('once@example.com')
  const [res] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/auth/request')),
    page.locator('[data-testid="signin-submit"]').click(),
  ])
  const { devLink } = await res.json() as { devLink: string }

  await page.goto(devLink)
  await expect(page).toHaveURL(/\/account$/)

  // A fresh visitor (no session) trying the spent link gets bounced.
  const ctx2 = await browser.newContext()
  const page2 = await ctx2.newPage()
  await page2.goto(devLink)
  await expect(page2).toHaveURL(/\/signup\?error=link/)

  await ctx2.close()
  await ctx.close()
})

test('delete account, then a fresh sign-in makes a new account', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await signIn(page, 'gone@example.com', 'Gone')
  await page.locator('[data-testid="account-delete"]').click()
  await page.locator('[data-testid="account-delete-confirm"]').click()
  await expect(page).toHaveURL(/\/$/) // back to the landing page, signed out

  await page.goto('/account')
  await expect(page).toHaveURL(/\/signup\?next=/)

  // Signing in again works and the account is fresh.
  await signIn(page, 'gone@example.com')
  await expect(page).toHaveURL(/\/account$/)

  await ctx.close()
})

test('a signed-in user keeps their account name in a JAM room (no name gate)', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await signIn(page, 'jammer@example.com', 'Jammer')

  await page.goto('/app/jam')
  await page.locator('[data-testid="create-room-button"]').click()
  await page.waitForURL(/\/app\/jam\/room\//)

  // No "what should we call you?" gate — the account name is used.
  await expect(page.locator('[data-testid="display-name-input"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="presence-names"]')).toHaveText('Jammer')

  await ctx.close()
})

test('gated doc: locked for anon (no prose in the HTML), open when signed in', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await page.goto('/docs/behind-the-scenes')
  await expect(page.locator('[data-testid="doc-locked"]')).toBeVisible()
  const anonHtml = await page.content()
  expect(anonHtml).not.toContain('no passwords are stored')

  // Nav still lists it.
  await page.goto('/docs')
  await expect(page.getByRole('link', { name: /Behind the scenes/ })).toBeVisible()

  await signIn(page, 'docreader@example.com')
  await page.goto('/docs/behind-the-scenes')
  await expect(page.locator('[data-testid="doc-locked"]')).toHaveCount(0)
  await expect(page.getByText('no passwords are stored')).toBeVisible()

  await ctx.close()
})
