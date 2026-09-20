import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { toStrudelUrl } from '../app/lib/strudelShareLink'

// add-jah-code-cards (JAH_E2E) — @jah's fenced Strudel code appears as a
// card with Preview / Copy code / Open in strudel.cc; previewing pauses the
// room for everyone for at most 5 seconds. The model is stubbed: the canned
// reply carries the fenced block below, so nothing here depends on (or
// spends tokens on) a real reply.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })
test.describe.configure({ retries: 2 })

// Must match server/jah/reply.ts's canned reply.
const CODE = 'note("c3 e3 g3").s("sawtooth").lpf(800).gain(0.3)'

async function signInAllowlisted(page: Page): Promise<void> {
  // e2e-allowlisted is in .dev.vars' AI_ACCESS_LOGINS.
  await page.goto('/auth/github?e2e=1&next=/account&e2e_id=1001&e2e_login=e2e-allowlisted'
    + '&e2e_name=Ally&e2e_email=ally-allowlisted@example.com')
  await page.waitForURL(/\/account/)
}

async function joinAsAnon(page: Page, roomId: string, name: string, query = ''): Promise<void> {
  await page.goto(`/app/composition/${roomId}${query}`)
  await page.getByTestId('display-name-input').fill(name)
  await page.getByTestId('submit-name-button').click()
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })
}

async function sendChat(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text)
  await page.getByTestId('chat-send').click()
}

/** Signs in the allowlisted user, enters the room, returns the page. */
async function joinAsAllowlisted(browser: import('@playwright/test').Browser, roomId: string) {
  const ctx = await browser.newContext()
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
  const page = await ctx.newPage()
  await signInAllowlisted(page)
  await page.goto(`/app/composition/${roomId}`)
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })
  return { ctx, page }
}

const card = (page: Page) => page.getByTestId('strudel-card')
const playButton = (page: Page) => page.getByTestId('play-stop-button')

test('an @jah reply shows a card with the code and its actions, and no Load buttons', async ({ browser }) => {
  test.setTimeout(120_000)
  const { ctx, page } = await joinAsAllowlisted(browser, `cards-basic-${Date.now()}`)

  await sendChat(page, '@jah what does .fast do?')
  await expect(card(page)).toHaveCount(1, { timeout: 20_000 })

  const c = card(page).first()
  await expect(c).toContainText(CODE)
  await expect(c.getByTestId('card-preview')).toBeVisible()
  await expect(c.getByTestId('card-copy')).toBeVisible()
  await expect(c.getByTestId('card-open')).toBeVisible()
  // No library-only actions on a chat card.
  await expect(c.getByTestId('load-into-jam')).toHaveCount(0)
  await expect(c.getByTestId('load-into-composition')).toHaveCount(0)
  // The prose around the code still renders as text.
  await expect(page.getByTestId('chat-message').filter({ hasText: /canned/i }).last()).toBeVisible()

  await ctx.close()
})

test('Copy puts exactly the code on the clipboard, and Open points at strudel.cc with that code', async ({ browser }) => {
  test.setTimeout(120_000)
  const { ctx, page } = await joinAsAllowlisted(browser, `cards-copy-${Date.now()}`)

  await sendChat(page, '@jah show me a pattern')
  const c = card(page).first()
  await expect(c).toBeVisible({ timeout: 20_000 })

  await c.getByTestId('card-copy').click()
  await expect(c.getByTestId('card-copy')).toContainText('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE)

  const href = await c.getByTestId('card-open').getAttribute('href')
  expect(href).toBe(toStrudelUrl(CODE))
  await expect(c.getByTestId('card-open')).toHaveAttribute('target', '_blank')

  await ctx.close()
})

test('a person\'s fenced code is an ordinary code block, not a card', async ({ browser }) => {
  test.setTimeout(120_000)
  const { ctx, page } = await joinAsAllowlisted(browser, `cards-human-${Date.now()}`)

  await sendChat(page, '```strudel\ns("bd sd")\n```')
  const own = page.locator('[data-testid="chat-message-row"][data-role="user"]').last()
  await expect(own).toBeVisible({ timeout: 15_000 })
  await expect(own.locator('pre code')).toContainText('s("bd sd")')
  await expect(card(page)).toHaveCount(0)
  await expect(own.getByTestId('card-preview')).toHaveCount(0)

  await ctx.close()
})

test('a viewer sees Copy and Open on a card but no Preview', async ({ browser }) => {
  test.setTimeout(150_000)
  const roomId = `cards-viewer-${Date.now()}`
  const { ctx, page } = await joinAsAllowlisted(browser, roomId)

  const viewerCtx = await browser.newContext()
  const viewer = await viewerCtx.newPage()
  await joinAsAnon(viewer, roomId, 'Val', '?role=viewer')

  await sendChat(page, '@jah hello')
  for (const p of [page, viewer]) await expect(card(p)).toHaveCount(1, { timeout: 20_000 })

  await expect(card(page).getByTestId('card-preview')).toBeVisible()
  await expect(card(viewer).getByTestId('card-copy')).toBeVisible()
  await expect(card(viewer).getByTestId('card-open')).toBeVisible()
  await expect(card(viewer).getByTestId('card-preview')).toHaveCount(0)

  await viewerCtx.close()
  await ctx.close()
})

test('Preview stops the room for everyone, ends by itself within seconds, and leaves the room stopped', async ({ browser }) => {
  test.setTimeout(180_000)
  const roomId = `cards-pause-${Date.now()}`
  const { ctx, page } = await joinAsAllowlisted(browser, roomId)

  const bobCtx = await browser.newContext()
  const bob = await bobCtx.newPage()
  await joinAsAnon(bob, roomId, 'Bob')

  // The room is playing for both of them.
  await playButton(page).click()
  await expect(playButton(page)).toHaveText('Stop', { timeout: 15_000 })
  await expect(playButton(bob)).toHaveText('Stop', { timeout: 15_000 })

  await sendChat(page, '@jah give me an example')
  await expect(card(page)).toHaveCount(1, { timeout: 20_000 })

  // Preview: the room stops for everyone (Bob included) and the snippet
  // plays for the previewer alone.
  await card(page).getByTestId('card-preview').click()
  await expect(playButton(bob)).toHaveText('Play', { timeout: 15_000 })
  await expect(playButton(page)).toHaveText('Play', { timeout: 15_000 })
  await expect(card(page).getByTestId('card-preview')).toHaveText('Stop', { timeout: 30_000 })
  // Bob has no preview running — the card in his chat still offers Preview.
  await expect(card(bob).getByTestId('card-preview')).toHaveText('Preview')

  // At most five seconds later it ends by itself, and nothing restarts.
  await expect(card(page).getByTestId('card-preview')).toHaveText('Preview', { timeout: 12_000 })
  await expect(playButton(page)).toHaveText('Play')
  await expect(playButton(bob)).toHaveText('Play')

  await bobCtx.close()
  await ctx.close()
})

test('pressing Play during a preview ends the preview and starts the room', async ({ browser }) => {
  test.setTimeout(150_000)
  const { ctx, page } = await joinAsAllowlisted(browser, `cards-eval-${Date.now()}`)

  await sendChat(page, '@jah give me an example')
  await expect(card(page)).toHaveCount(1, { timeout: 20_000 })

  await card(page).getByTestId('card-preview').click()
  await expect(card(page).getByTestId('card-preview')).toHaveText('Stop', { timeout: 30_000 })

  await playButton(page).click()
  await expect(card(page).getByTestId('card-preview')).toHaveText('Preview', { timeout: 10_000 })
  await expect(playButton(page)).toHaveText('Stop', { timeout: 15_000 })

  await ctx.close()
})

test('a pattern card stays inside the chat at phone width', async ({ browser }) => {
  test.setTimeout(120_000)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await signInAllowlisted(page)
  await page.goto(`/app/composition/cards-phone-${Date.now()}`)
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })

  await sendChat(page, '@jah give me an example')
  await expect(card(page)).toHaveCount(1, { timeout: 20_000 })
  await expect(card(page).getByTestId('card-open')).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  await ctx.close()
})
