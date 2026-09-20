import type { Browser, BrowserContext, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// uplift-chat-interface — the Composition Room's Chat tab on Nuxt UI's
// chat components: multi-line input, own/other/@jah styling, Markdown that
// is safe for anonymous senders, the "to @jah" switch and the model
// selector placeholder. Server-side @jah gating and the `welcome.jah`
// values have pool-workers coverage (test/jah-chat.test.ts); markdown
// safety has unit coverage (test/chat-markdown.test.ts) — this file
// checks the same things end to end in a real browser.
test.describe.configure({ retries: 2 })

const ROW = '[data-testid="chat-message-row"]'

async function signInAllowlisted(page: Page): Promise<void> {
  // e2e-allowlisted is in .dev.vars' AI_ACCESS_LOGINS.
  await page.goto('/auth/github?e2e=1&next=/account&e2e_id=1001&e2e_login=e2e-allowlisted'
    + '&e2e_name=Ally&e2e_email=ally-allowlisted@example.com')
  await page.waitForURL(/\/account/)
}

async function signInWithoutAccess(page: Page): Promise<void> {
  await page.goto('/auth/github?e2e=1&next=/account&e2e_id=1002&e2e_login=no-access-user'
    + '&e2e_name=NoAccess&e2e_email=no-access@example.com')
  await page.waitForURL(/\/account/)
}

/** Joins a room anonymously under `name`; resolves once Chat is showing. */
async function joinAnon(context: BrowserContext, roomId: string, name: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`/app/composition/${roomId}`)
  await page.getByTestId('display-name-input').fill(name)
  await page.getByTestId('submit-name-button').click()
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })
  return page
}

async function newAnon(browser: Browser, roomId: string, name: string): Promise<Page> {
  return joinAnon(await browser.newContext(), roomId, name)
}

async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text)
  await page.getByTestId('chat-send').click()
}

test('Enter sends, Shift+Enter adds a line, an empty message is not sent', async ({ browser }) => {
  test.setTimeout(90_000)
  const page = await newAnon(browser, `ci-input-${Date.now()}`, 'Alice')
  const input = page.getByTestId('chat-input')
  const rows = page.locator(ROW)
  const before = await rows.count() // @jah's welcome

  // Nothing typed / only whitespace → nothing sent.
  await input.click()
  await page.keyboard.press('Enter')
  await input.fill('   ')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  await expect(rows).toHaveCount(before)

  // Shift+Enter inserts a line break and does NOT send.
  await input.fill('')
  await page.keyboard.type('first line')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('second line')
  await expect(input).toHaveValue('first line\nsecond line')
  await expect(rows).toHaveCount(before)

  // The box grew to fit the second line.
  const oneLine = (await input.boundingBox())!.height
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('third line')
  await expect.poll(async () => (await input.boundingBox())!.height).toBeGreaterThan(oneLine)

  // Enter sends the whole thing and clears the box; lines stay on their own lines.
  await page.keyboard.press('Enter')
  await expect(rows).toHaveCount(before + 1)
  await expect(input).toHaveValue('')
  const sent = page.locator(`${ROW}[data-role="user"]`).last().getByTestId('chat-message')
  await expect(sent.locator('br')).toHaveCount(2)
  await expect(sent).toContainText('first line')
  await expect(sent).toContainText('third line')
})

test('my message is set apart; another person\'s is on the left with their name', async ({ browser }) => {
  test.setTimeout(90_000)
  const roomId = `ci-sides-${Date.now()}`
  const alice = await newAnon(browser, roomId, 'Alice')
  const bob = await newAnon(browser, roomId, 'Bob')

  await send(alice, 'hello from alice')
  await send(bob, 'hello from bob')

  // In Alice's own view: hers is on the right without her name, Bob's on
  // the left carrying his.
  const mine = alice.locator(ROW).filter({ hasText: 'hello from alice' })
  const theirs = alice.locator(ROW).filter({ hasText: 'hello from bob' })
  await expect(mine).toHaveCount(1, { timeout: 15_000 })
  await expect(theirs).toHaveCount(1, { timeout: 15_000 })
  await expect(theirs).toContainText('Bob')
  await expect(mine.getByText('Alice', { exact: true })).toBeHidden()
  const mineBox = (await mine.getByTestId('chat-message').boundingBox())!
  const theirsBox = (await theirs.getByTestId('chat-message').boundingBox())!
  expect(mineBox.x).toBeGreaterThan(theirsBox.x)

  // …and mirrored in Bob's view.
  await expect(bob.locator(ROW).filter({ hasText: 'hello from alice' })).toContainText('Alice')
  const bobsOwn = (await bob.locator(ROW).filter({ hasText: 'hello from bob' }).getByTestId('chat-message').boundingBox())!
  const bobsOther = (await bob.locator(ROW).filter({ hasText: 'hello from alice' }).getByTestId('chat-message').boundingBox())!
  expect(bobsOwn.x).toBeGreaterThan(bobsOther.x)
})

test('@jah\'s welcome is styled as the assistant, distinct from people, with the lion avatar', async ({ browser }) => {
  test.setTimeout(90_000)
  const roomId = `ci-jah-style-${Date.now()}`
  const alice = await newAnon(browser, roomId, 'Alice')
  const bob = await newAnon(browser, roomId, 'Bob')
  await send(bob, 'a human message')

  const jah = alice.locator(`${ROW}[data-role="assistant"]`).first()
  const human = alice.locator(ROW).filter({ hasText: 'a human message' })
  await expect(human).toHaveCount(1, { timeout: 15_000 })

  const bubble = (row: ReturnType<Page['locator']>) => row.locator('[data-slot="content"]').evaluate((el) => {
    const cs = getComputedStyle(el)
    return `${cs.backgroundColor}|${cs.boxShadow}|${cs.borderColor}|${cs.color}`
  })
  expect(await bubble(jah)).not.toBe(await bubble(human))

  // The avatar is the static lion, and credits its artist on hover.
  const avatar = jah.locator('img')
  await expect(avatar).toHaveAttribute('src', /jah-avatar\.svg/)
  await expect(avatar).toHaveAttribute('title', /Lorc.*CC BY 3\.0/)
  const svg = await (await alice.request.get('/jah-avatar.svg')).text()
  expect(svg).toContain('Lorc')
  expect(svg).toContain('CC BY 3.0')
})

test('messages render Markdown, and a hostile message does nothing', async ({ browser }) => {
  test.setTimeout(90_000)
  const roomId = `ci-md-${Date.now()}`
  const requests: string[] = []
  const sender = await newAnon(browser, roomId, 'Mallory')
  const victim = await newAnon(browser, roomId, 'Victim')
  victim.on('request', r => requests.push(r.url()))
  await victim.exposeFunction('__pwned', () => requests.push('PWNED'))

  await send(sender, 'plain **bold** and `s("bd*4 hh*8")`')
  await send(
    sender,
    'HOSTILE <img src=x onerror="window.__pwned()"> ![pic](https://evil.invalid/p.png) '
    + '[bad](javascript:window.__pwned()) [ok](https://example.com/page)',
  )

  const md = victim.locator(ROW).filter({ hasText: 'plain' })
  await expect(md).toHaveCount(1, { timeout: 15_000 })
  await expect(md.locator('strong')).toHaveText('bold')
  await expect(md.locator('code')).toHaveText('s("bd*4 hh*8")')

  const hostile = victim.locator(ROW).filter({ hasText: 'HOSTILE' })
  await expect(hostile).toHaveCount(1, { timeout: 15_000 })
  // Raw HTML is shown as text; no element, no image; the alt text remains.
  await expect(hostile).toContainText('<img src=x onerror="window.__pwned()">')
  await expect(hostile.locator('img')).toHaveCount(0)
  await expect(hostile).toContainText('pic')
  // Only the http(s) link is a link, and it opens safely.
  const links = hostile.locator('a')
  await expect(links).toHaveCount(1)
  await expect(links.first()).toHaveAttribute('href', 'https://example.com/page')
  await expect(links.first()).toHaveAttribute('target', '_blank')
  await expect(links.first()).toHaveAttribute('rel', /noopener/)
  await expect(hostile).toContainText('[bad](javascript:window.__pwned())')

  await victim.waitForTimeout(500)
  expect(requests.filter(u => u.includes('evil.invalid'))).toEqual([])
  expect(requests).not.toContain('PWNED')
})

test('the "to @jah" switch prefixes messages, stays on, and does not double a mention', async ({ browser }) => {
  test.setTimeout(120_000)
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await signInAllowlisted(page)
  const roomId = `ci-switch-${Date.now()}`
  await page.goto(`/app/composition/${roomId}`)
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })
  const watcher = await newAnon(browser, roomId, 'Watcher')

  const toggle = page.getByTestId('jah-switch').getByRole('switch').or(page.getByRole('switch', { name: 'to @jah' })).first()
  // Starts off, and enabled for an allowlisted account.
  await expect(toggle).toBeEnabled({ timeout: 15_000 })
  await expect(toggle).not.toBeChecked()
  await expect(page.getByTestId('jah-switch-hint')).toHaveCount(0)

  // Off: sent as typed.
  await send(page, 'plain message')
  await expect(watcher.locator(ROW).filter({ hasText: 'plain message' }).getByTestId('chat-message'))
    .toHaveText('plain message', { timeout: 15_000 })

  // On: @jah is prepended, and the room sees it (the exchange stays public).
  await toggle.click()
  await expect(toggle).toBeChecked()
  await send(page, 'what does .fast do?')
  await expect(watcher.locator(ROW).filter({ hasText: 'what does .fast do?' }).getByTestId('chat-message'))
    .toHaveText('@jah what does .fast do?', { timeout: 15_000 })

  // Still on for the next message.
  await expect(toggle).toBeChecked()
  await send(page, 'and .slow?')
  await expect(watcher.locator(ROW).filter({ hasText: 'and .slow?' }).getByTestId('chat-message'))
    .toHaveText('@jah and .slow?', { timeout: 15_000 })

  // An existing mention is not doubled.
  await send(page, '@jah one more')
  await expect(watcher.locator(ROW).filter({ hasText: 'one more' }).getByTestId('chat-message'))
    .toHaveText('@jah one more', { timeout: 15_000 })

  // Switched back off: sent as typed again.
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await send(page, 'plain again')
  await expect(watcher.locator(ROW).filter({ hasText: 'plain again' }).getByTestId('chat-message'))
    .toHaveText('plain again', { timeout: 15_000 })

  await ctx.close()
})

test('the switch is disabled, with a reason, when @jah can\'t reply', async ({ browser }) => {
  test.setTimeout(120_000)

  // Anonymous → sign in to talk to @jah.
  const anon = await newAnon(browser, `ci-anon-${Date.now()}`, 'Anon')
  await expect(anon.getByRole('switch', { name: 'to @jah' })).toBeDisabled()
  await expect(anon.getByTestId('jah-switch-hint')).toContainText(/sign in/i)

  // Typing the mention by hand still works (no client-side block).
  await send(anon, '@jah hello?')
  await expect(anon.locator(`${ROW}[data-role="user"]`).filter({ hasText: '@jah hello?' })).toHaveCount(1, { timeout: 10_000 })

  // Signed in without access → invite-only.
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await signInWithoutAccess(page)
  await page.goto(`/app/composition/ci-noaccess-${Date.now()}`)
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('switch', { name: 'to @jah' })).toBeDisabled()
  await expect(page.getByTestId('jah-switch-hint')).toContainText(/invite-only/i)
  await ctx.close()
})

test('the model selector says it is not implemented and changes nothing', async ({ browser }) => {
  test.setTimeout(90_000)
  const page = await newAnon(browser, `ci-model-${Date.now()}`, 'Alice')

  await page.getByTestId('model-selector').click()
  // The toast's own title (Nuxt UI also mirrors it into an aria-live region).
  await expect(page.locator('[data-slot="title"]').filter({ hasText: /Model selection isn.t available yet/i })).toBeVisible()

  // Chat still works exactly as before afterwards.
  await send(page, 'after the toast')
  await expect(page.locator(`${ROW}[data-role="user"]`).filter({ hasText: 'after the toast' })).toHaveCount(1, { timeout: 15_000 })
})
