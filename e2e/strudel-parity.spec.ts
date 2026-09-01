import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// add-strudel-parity — JAM tracks run the full StrudelMirror engine:
// pattern-driven visuals, mini-notation event highlight, $: documents.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })

async function roomWithTrackA(page: Page): Promise<void> {
  await page.goto('/app/jam')
  await expect(async () => {
    await page.locator('[data-testid="create-room-button"]').click()
    await page.waitForURL(/\/app\/jam\/room\//, { timeout: 2000 })
  }).toPass({ timeout: 30_000 })
  await page.locator('[data-testid="display-name-input"]').fill('Vis')
  await page.locator('[data-testid="submit-name-button"]').click()
  await expect(page.locator('[data-testid="display-name-input"]')).toHaveCount(0)
  await page.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()
  await expect(page.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('You')
}

async function setCode(page: Page, code: string): Promise<void> {
  await page.locator('[data-testid="track-a"] .cm-content').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(code)
}

async function play(page: Page): Promise<void> {
  await page.locator('[data-testid="track-a"] [data-testid="play-stop-button"]').click()
  await expect(page.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toBeVisible()
}

test('a pattern-driven visualiser shows a canvas; a plain pattern does not', async ({ page }) => {
  test.setTimeout(60_000)
  await roomWithTrackA(page)
  const canvas = page.locator('[data-testid="track-a"] [data-testid="track-canvas"]')

  await setCode(page, 's("bd sd").punchcard()')
  await play(page)
  await expect(canvas).toBeVisible({ timeout: 15_000 })

  await page.locator('[data-testid="track-a"] [data-testid="play-stop-button"]').click()
  await setCode(page, 'note("c3 e3 g3").s("triangle")')
  await play(page)
  await page.waitForTimeout(2000)
  await expect(canvas).toBeHidden()
})

test('a $: document plays every label with no pattern error', async ({ page }) => {
  test.setTimeout(60_000)
  await roomWithTrackA(page)
  await setCode(page, '$: s("bd*4")\n$: s("hh*8")')
  await play(page)
  await page.waitForTimeout(2500)
  await expect(page.locator('[data-testid="track-a"]').getByText('Pattern error')).toHaveCount(0)
})

test('the editor highlights the playing token', async ({ page }) => {
  test.setTimeout(60_000)
  await roomWithTrackA(page)
  await setCode(page, 's("bd sd hh cp")')
  await play(page)
  // The mini-notation highlight adds an inline-styled mark to the sounding token.
  await expect(
    page.locator('[data-testid="track-a"] .cm-content [style*="outline"]').first(),
  ).toBeVisible({ timeout: 15_000 })
})
