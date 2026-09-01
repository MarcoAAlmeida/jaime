import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// add-strudel-parity — JAM tracks run the full StrudelMirror engine:
// mini-notation event highlight, $: documents, pattern-driven visuals.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })
test.describe.configure({ retries: 2 })

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

// How many pixels the track's backdrop canvas has actually painted.
async function paintedPixels(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('[data-testid="track-a"] [data-testid="track-canvas"]') as HTMLCanvasElement | null
    if (!c) return -1
    const ctx = c.getContext('2d')!
    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    let n = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) n++
    return n
  })
}

test('a .punchcard() pattern draws on the editor backdrop; a plain one does not', async ({ page }) => {
  test.setTimeout(90_000)
  await roomWithTrackA(page)

  await setCode(page, 's("bd sd hh cp").punchcard()')
  await play(page)
  await expect.poll(() => paintedPixels(page), { timeout: 45_000, message: 'punchcard should paint the canvas' })
    .toBeGreaterThan(500)

  await page.locator('[data-testid="track-a"] [data-testid="play-stop-button"]').click()
  await setCode(page, 'note("c3 e3 g3").s("triangle")')
  await play(page)
  await expect.poll(() => paintedPixels(page), { timeout: 10_000, message: 'a plain pattern clears the backdrop' })
    .toBeLessThan(500)
})

test('a visual call inside a $: document still draws', async ({ page }) => {
  test.setTimeout(90_000)
  await roomWithTrackA(page)
  await setCode(page, '$: s("bd*4").punchcard()\n$: s("hh*8")')
  await play(page)
  await expect.poll(() => paintedPixels(page), { timeout: 30_000 }).toBeGreaterThan(500)
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
