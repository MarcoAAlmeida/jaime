import { expect, test } from '@playwright/test'

// rebrand-homepage — the landing page pitches a hangout for developers:
// the tagline, `@jah` as the headline, one primary action into a fresh
// Composition Room, starter patterns that open in a room, JAM demoted to
// low-key links, a non-link games notice, and per-icon game-icons credit.
test.describe.configure({ retries: 1 })

const TAGLINE = 'Your dev hangout — live-code, chat, and let @jah keep watch.'
const CONTENT = '[data-testid="composition-editor"] .cm-content'

async function enterName(page: import('@playwright/test').Page, name: string) {
  await page.locator('[data-testid="display-name-input"]').fill(name)
  await page.locator('[data-testid="submit-name-button"]').click()
  await expect(page.locator('[data-testid="display-name-input"]')).toHaveCount(0)
}

test('the tagline is visible above the fold and the page no longer pitches a music-tools hub', async ({ page }) => {
  await page.goto('/')
  const h1 = page.getByRole('heading', { level: 1 })
  await expect(h1).toHaveText(TAGLINE)
  await expect(h1).toBeInViewport()
  await expect(page.locator('body')).not.toContainText('hub of small')
  await expect(page).toHaveTitle(/your dev hangout/i)
})

test('exactly one primary action, "Start a room", lands in a fresh room on the Chat tab', async ({ page }) => {
  await page.goto('/')
  // Exactly one solid primary-coloured action on the page — the hero's;
  // every other "Start a room" is neutral.
  const primary = page.locator('main a.bg-primary, main button.bg-primary')
  await expect(primary).toHaveCount(1)
  await expect(primary).toHaveText('Start a room')

  await page.getByRole('button', { name: 'Start a room' }).first().click()
  await expect(page).toHaveURL(/\/app\/composition\/[\w-]+$/)
  await enterName(page, 'Lander')
  await expect(page.locator('[data-testid="chat"]')).toBeVisible()
})

test('the @jah section shows the lion, the mention form, and honest access', async ({ page }) => {
  await page.goto('/')
  const section = page.getByTestId('jah-section')
  await expect(section).toBeVisible()
  await expect(section.getByTestId('jah-lion')).toBeVisible()
  await expect(section).toContainText('@jah how does .fast work?')
  await expect(section).toContainText('Invite-only for now')

  await section.getByTestId('jah-start-room').click()
  await expect(page).toHaveURL(/\/app\/composition\/[\w-]+$/)
})

test('the hero links to the pattern library, and JAM is only in the footer', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Pattern library' }).first()).toHaveAttribute('href', '/app/patterns')

  const main = page.getByRole('main')
  await expect(main).not.toContainText('JAM')
  await expect(main.getByRole('link', { name: /^JAM$/ })).toHaveCount(0)

  const footerJam = page.getByRole('contentinfo').getByRole('link', { name: 'JAM' })
  await expect(footerJam).toHaveAttribute('href', '/app/jam')
})

test('each starter pattern opens a fresh Composition Room with its code loaded', async ({ page }) => {
  // An anonymous visitor's name is kept in sessionStorage and picked up when
  // a page loads, so a tab that already named itself is not asked again (by
  // design). Each starter here is a fresh visitor: forget the name on every
  // page load, before the app reads it.
  await page.addInitScript(() => sessionStorage.removeItem('jaime-display-name'))

  await page.goto('/')
  const cards = page.getByTestId('starter-card')
  await expect(cards.first()).toBeVisible()
  const count = await cards.count()
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    await page.goto('/')
    await page.getByTestId('starter-card').nth(i).getByTestId('starter-open').click()
    await expect(page).toHaveURL(/\/app\/composition\/[\w-]+\?load=[\w-]+$/)
    await enterName(page, `Starter${i}`)
    await page.locator('[data-testid="tab-composition"]:visible, [data-testid="tab-mobile-composition"]:visible').click()
    const editor = page.locator(CONTENT)
    await expect(editor).toBeVisible({ timeout: 60_000 })
    // A seeded room holds real pattern code, not an empty document.
    await expect
      .poll(async () => (await editor.innerText()).trim().length, { timeout: 30_000 })
      .toBeGreaterThan(20)
  }
})

test('the games notice is present and is not a link', async ({ page }) => {
  await page.goto('/')
  const notice = page.getByTestId('games-notice')
  await expect(notice).toContainText('Games — coming soon')
  await expect(notice.locator('a')).toHaveCount(0)
})

test('the page credits every game-icons icon to its author', async ({ page }) => {
  await page.goto('/')
  const credits = page.getByTestId('icon-credits')
  await expect(credits).toContainText('game-icons.net')
  for (const [name, author] of [
    ['lion', 'Lorc'],
    ['chat-bubble', 'Delapouite'],
    ['musical-notes', 'Delapouite'],
    ['rune-stone', 'Lorc'],
    ['scroll-unfurled', 'Lorc'],
    ['laptop', 'Delapouite'],
    ['campfire', 'Lorc'],
    ['sound-waves', 'Skoll'],
    ['console-controller', 'Skoll'],
  ]) {
    await expect(credits).toContainText(`${name} by ${author}`)
  }
})

test('the landing page has no horizontal overflow at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
