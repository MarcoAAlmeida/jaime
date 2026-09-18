import { expect, test } from '@playwright/test'

// add-oauth-signin — the OAUTH_E2E flag (.dev.vars) short-circuits the
// GitHub callback with a canned, query-parameterisable profile, so the
// flow is exercised without real GitHub credentials.

test('the GitHub button signs in with a confirmed account', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.getByTestId('signin-github')).toBeVisible()
  await page.getByTestId('signin-github').click()

  // Lands signed in (the button links to /auth/github, which redirects
  // through the canned callback and on to /account).
  await page.waitForURL(/\/account/)
  const me = await page.evaluate(() => fetch('/api/auth/me').then(r => r.json()))
  expect(me.user).toBeTruthy()
  expect(me.user.status).toBe('confirmed')
  expect(me.user.displayName).toBe('E2E Octocat')

  // The avatar shows on the account page and in the sidebar account
  // link — not the abstract user icon.
  await expect(page.locator('main img[src*="avatars.githubusercontent.com"]')).toBeVisible()
  await expect(
    page.getByTestId('account-link').locator('img[src*="avatars.githubusercontent.com"]'),
  ).toBeVisible()
})

test('a second GitHub sign-in returns to the same account', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const p1 = await ctx1.newPage()
  await p1.goto('/auth/github?next=/account')
  await p1.waitForURL(/\/account/)
  const id1 = (await p1.evaluate(() => fetch('/api/auth/me').then(r => r.json()))).user.id

  // A fresh browser, same canned github id → same jaime account.
  const ctx2 = await browser.newContext()
  const p2 = await ctx2.newPage()
  await p2.goto('/auth/github?next=/account')
  await p2.waitForURL(/\/account/)
  const id2 = (await p2.evaluate(() => fetch('/api/auth/me').then(r => r.json()))).user.id

  expect(id2).toBe(id1)
  await ctx1.close()
  await ctx2.close()
})

test('a signed-in GitHub user joins rooms with no name prompt, avatar shown', async ({ browser }) => {
  test.setTimeout(180_000)
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  // Sign in with a distinctive canned profile. A distinct e2e_email is
  // required: the default lands on the shared e2e-octocat account (email
  // match), which keeps its own display name and the test's `hasText`
  // filter would never match.
  await page.goto('/auth/github?e2e=1&next=/account&e2e_id=778899&e2e_login=avataruser'
    + '&e2e_name=Avatar%20User&e2e_email=avatar-user@example.com'
    + '&e2e_avatar=https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F778899%3Fv%3D4')
  await page.waitForURL(/\/account/)

  // Composition Room — straight in, no "what should we call you".
  const roomId = `oauth-${Date.now()}`
  await page.goto(`/app/composition/${roomId}`)
  await expect(page.getByTestId('display-name-input')).toHaveCount(0)
  await page.getByTestId('role-editor').click()
  await expect(page.locator('[data-testid="composition-editor"] .cm-content')).toBeVisible({ timeout: 60_000 })

  // An anonymous second person joins the same room.
  const anon = await (await browser.newContext()).newPage()
  await anon.goto(`/app/composition/${roomId}`)
  await anon.getByTestId('display-name-input').fill('Nobody')
  await anon.getByTestId('submit-name-button').click()
  await anon.getByTestId('role-viewer').click()
  await expect(anon.locator('[data-testid="composition-editor"] .cm-content')).toBeVisible({ timeout: 60_000 })

  // The signed-in user's roster entry (seen by the anon) has a real
  // avatar image; the anon's own entry falls back to an initial.
  const signedInRow = anon.locator('[data-testid="participant"]').filter({ hasText: 'Avatar User' })
  await expect(signedInRow.locator('img')).toHaveAttribute('src', /avatars\.githubusercontent\.com/, { timeout: 15_000 })
  const anonRow = anon.locator('[data-testid="participant"]').filter({ hasText: 'Nobody' })
  await expect(anonRow.locator('img')).toHaveCount(0)

  // And in chat.
  await page.getByTestId('tab-chat').click()
  await page.getByTestId('chat-input').fill('hi from github')
  await page.getByTestId('chat-send').click()
  const msgRow = anon.locator('[data-testid="chat-message-row"]').filter({ hasText: 'hi from github' })
  await expect(msgRow.locator('img')).toHaveAttribute('src', /avatars\.githubusercontent\.com/, { timeout: 15_000 })

  await ctx.close()
})

test('a signed-in GitHub user joins a JAM room with no name prompt', async ({ browser }) => {
  test.setTimeout(120_000)
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/auth/github?next=/account')
  await page.waitForURL(/\/account/)

  await page.goto('/app/jam')
  await expect(async () => {
    await page.locator('[data-testid="create-room-button"]').click()
    await page.waitForURL(/\/app\/jam\/room\//, { timeout: 2000 })
  }).toPass({ timeout: 30_000 })
  await expect(page.getByTestId('display-name-input')).toHaveCount(0)
  await expect(page.locator('[data-testid="track-a"] .cm-content')).toBeVisible({ timeout: 60_000 })

  await ctx.close()
})
