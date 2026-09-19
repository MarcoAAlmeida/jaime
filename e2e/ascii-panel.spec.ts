import type { BrowserContext, Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

// add-ascii-overlay — the Composition Room's decorative ASCII-art
// content, reached via the ASCII Art tab (add-composition-tabs):
// swaps on a per-viewer beat interval while the room plays, never
// while stopped.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })
test.describe.configure({ retries: 2 })

const CONTENT = '[data-testid="composition-editor"] .cm-content'

// Idempotent fixture rows, independent of whether
// scripts/scrape-ascii-gallery.mjs has been run in this environment —
// the panel needs *some* distinct pieces to cycle through to test
// swapping, never asserted on by content.
test.beforeAll(() => {
  const rows = [
    ['e2e-ascii-a', 'A', 'AAA'],
    ['e2e-ascii-b', 'B', 'BBB'],
    ['e2e-ascii-c', 'C', 'CCC'],
  ]
  const values = rows
    .map(([id, title, text]) =>
      `('${id}','${title}','Tester','test','test',3,1,'${text}','https://www.asciiart.eu/art/${id}','2026-01-01T00:00:00.000Z')`)
    .join(', ')
  const sql = `INSERT INTO ascii_art (id, title, artist, category, subcategory, width, height, text, source_url, scraped_at) `
    + `VALUES ${values} ON CONFLICT(id) DO NOTHING;`
  const file = join(mkdtempSync(join(tmpdir(), 'jaime-ascii-e2e-')), 'seed.sql')
  writeFileSync(file, sql)
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'PATTERNS_DB', '--local', '--file', file], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
})

async function joinRoom(context: BrowserContext, roomId: string, name: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`/app/composition/${roomId}`)
  await page.locator('[data-testid="display-name-input"]').fill(name)
  await page.locator('[data-testid="submit-name-button"]').click()
  // Chat is the default landing tab (add-jah-chat); both tests below
  // interact with Composition first, so switch there once, centrally.
  await page.locator('[data-testid="tab-composition"]').click()
  await expect(page.locator(CONTENT)).toBeVisible({ timeout: 60_000 })
  return page
}

test('the ASCII Art tab is exclusive of Composition and Chat, and never covers the header', async ({ browser }) => {
  test.setTimeout(120_000)
  const context = await browser.newContext()
  const page = await joinRoom(context, `ascii-toggle-${Date.now()}`, 'Alice')

  const panel = page.locator('[data-testid="ascii-panel"]')
  const chatPanel = page.locator('[data-testid="chat-panel"]')
  const editor = page.locator('[data-testid="composition-editor"]')
  const asciiTab = page.locator('[data-testid="tab-ascii"]')

  await expect(panel).toBeHidden()
  await asciiTab.click()
  await expect(panel).toBeVisible()
  // Switching tabs is exclusive — Composition and Chat are hidden
  // while ASCII Art is active — and the room header stays reachable.
  await expect(chatPanel).toBeHidden()
  await expect(editor).toBeHidden()
  await expect(page.locator('[data-testid="tab-switcher"]')).toBeVisible()

  await page.locator('[data-testid="tab-composition"]').click()
  await expect(panel).toBeHidden()
  await expect(editor).toBeVisible()

  await context.close()
})

test('advances on a beat interval during playback, supports manual shuffle, and freezes when stopped', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()
  const page = await joinRoom(context, `ascii-swap-${Date.now()}`, 'Alice')

  await page.locator(CONTENT).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText('s("bd*4")')

  await page.locator('[data-testid="tab-ascii"]').click()
  const artText = page.locator('[data-testid="ascii-art-text"]')
  await expect(artText).toBeVisible({ timeout: 15_000 })

  // Fastest deterministic cadence: swap every beat.
  for (let i = 0; i < 10; i++) await page.locator('[data-testid="ascii-interval-decrease"]').click()
  await expect(page.locator('[data-testid="ascii-interval-value"]')).toHaveText('1')

  await page.locator('[data-testid="play-stop-button"]').click()
  await expect(page.locator('[data-testid="play-stop-button"]')).toHaveText('Stop')

  const firstPiece = await artText.textContent()
  await expect.poll(() => artText.textContent(), { timeout: 10_000 }).not.toBe(firstPiece)

  // Manual shuffle also advances, independent of the beat timer.
  const beforeManual = await artText.textContent()
  await page.locator('[data-testid="ascii-shuffle-button"]').click()
  await expect.poll(() => artText.textContent(), { timeout: 5_000 }).not.toBe(beforeManual)

  // Stopping freezes the displayed piece.
  await page.locator('[data-testid="play-stop-button"]').click()
  await expect(page.locator('[data-testid="play-stop-button"]')).toHaveText('Play')
  const stoppedPiece = await artText.textContent()
  await page.waitForTimeout(3000)
  expect(await artText.textContent()).toBe(stoppedPiece)

  await context.close()
})
