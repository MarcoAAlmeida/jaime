import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// add-jah-chat (JAH_E2E) — @jah as a discussion-only AI participant in
// the Composition Room's chat. Never asserts on real reply content
// beyond the canned JAH_E2E string; access/cap/kill-switch logic and
// the busy lock have their own pool-workers coverage
// (test/jah-chat.test.ts).
test.describe.configure({ retries: 2 })

async function signInAllowlisted(page: Page): Promise<void> {
  // e2e-allowlisted is in .dev.vars' AI_ACCESS_LOGINS.
  await page.goto('/auth/github?e2e=1&next=/account&e2e_id=1001&e2e_login=e2e-allowlisted'
    + '&e2e_name=Ally&e2e_email=ally-allowlisted@example.com')
  await page.waitForURL(/\/account/)
}

async function signInWithoutAccess(page: Page): Promise<void> {
  // The default canned OAUTH_E2E profile is not in AI_ACCESS_LOGINS.
  await page.goto('/auth/github?e2e=1&next=/account&e2e_id=1002&e2e_login=no-access-user'
    + '&e2e_name=NoAccess&e2e_email=no-access@example.com')
  await page.waitForURL(/\/account/)
}

async function sendChat(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text)
  await page.getByTestId('chat-send').click()
}

function jahRow(page: Page) {
  return page.locator('[data-testid="chat-message-row"]').filter({ hasText: '@jah:' })
}

test('an allowlisted signed-in user gets a real @jah reply, visible to everyone', async ({ browser }) => {
  test.setTimeout(90_000)
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await signInAllowlisted(page)

  const roomId = `jah-allowed-${Date.now()}`
  await page.goto(`/app/composition/${roomId}`)
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })

  // An anonymous second person is also in the room to see the reply.
  const anon = await (await browser.newContext()).newPage()
  await anon.goto(`/app/composition/${roomId}`)
  await anon.getByTestId('display-name-input').fill('Watcher')
  await anon.getByTestId('submit-name-button').click()
  await expect(anon.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })

  await sendChat(page, '@jah what does .fast do?')
  await expect(page.getByTestId('jah-typing')).toBeVisible({ timeout: 10_000 })

  for (const p of [page, anon]) {
    const row = jahRow(p)
    await expect(row.last()).toBeVisible({ timeout: 15_000 })
    await expect(row.last().locator('img')).toHaveAttribute('src', /jah-avatar\.svg/)
  }

  await ctx.close()
})

test('a signed-in, non-allowlisted user is told @jah is invite-only', async ({ page }) => {
  test.setTimeout(90_000)
  await signInWithoutAccess(page)

  const roomId = `jah-noaccess-${Date.now()}`
  await page.goto(`/app/composition/${roomId}`)
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })

  await sendChat(page, '@jah are you there?')
  const row = jahRow(page).last()
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row).toContainText(/invite-only/i)
})

test('an anonymous user addressing @jah gets no reply', async ({ page }) => {
  test.setTimeout(90_000)
  const roomId = `jah-anon-${Date.now()}`
  await page.goto(`/app/composition/${roomId}`)
  await page.getByTestId('display-name-input').fill('Anon')
  await page.getByTestId('submit-name-button').click()
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })

  // The welcome message is @jah's only entry here — no reply follows.
  await expect(jahRow(page)).toHaveCount(1)
  await sendChat(page, '@jah hello?')
  await expect(
    page.locator('[data-testid="chat-message-row"]').filter({ hasText: 'Anon: @jah hello?' }),
  ).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(1000)
  await expect(jahRow(page)).toHaveCount(1) // still just the welcome
})

test('a brand-new room opens with @jah\'s welcome, on the Chat tab, not repeated for a second joiner', async ({ browser }) => {
  test.setTimeout(90_000)
  const context = await browser.newContext()
  const roomId = `jah-welcome-${Date.now()}`

  const pageA = await context.newPage()
  await pageA.goto(`/app/composition/${roomId}`)
  await pageA.getByTestId('display-name-input').fill('Alice')
  await pageA.getByTestId('submit-name-button').click()

  // Chat is the default landing tab (add-jah-chat) — no tab click needed.
  await expect(pageA.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })
  await expect(jahRow(pageA)).toHaveCount(1)

  const pageB = await context.newPage()
  await pageB.goto(`/app/composition/${roomId}`)
  await pageB.getByTestId('display-name-input').fill('Bob')
  await pageB.getByTestId('submit-name-button').click()
  await expect(pageB.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })
  await expect(jahRow(pageB)).toHaveCount(1) // not posted again for Bob

  await context.close()
})
