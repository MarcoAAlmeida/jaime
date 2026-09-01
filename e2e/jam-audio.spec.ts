import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// Real audio check: playing a JAM track actually schedules Web Audio
// nodes, not just flips a "Playing" badge. Guards the engine swap
// (add-strudel-parity) against "looks like it plays but is silent".
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })
test.describe.configure({ retries: 2 })

async function roomWithTrackA(page: Page): Promise<void> {
  await page.goto('/app/jam')
  await expect(async () => {
    await page.locator('[data-testid="create-room-button"]').click()
    await page.waitForURL(/\/app\/jam\/room\//, { timeout: 2000 })
  }).toPass({ timeout: 30_000 })
  await page.locator('[data-testid="display-name-input"]').fill('Aud')
  await page.locator('[data-testid="submit-name-button"]').click()
  await expect(page.locator('[data-testid="display-name-input"]')).toHaveCount(0)
}

// Count AudioBufferSourceNode.start() (samples) + OscillatorNode.start()
// (synths) over `ms` while the given testid track is playing.
async function audioNodeStarts(page: Page, ms: number): Promise<{ buf: number, osc: number }> {
  return page.evaluate(async (ms) => {
    const c = { buf: 0, osc: 0 }
    const ob = AudioBufferSourceNode.prototype.start
    const oo = OscillatorNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...a: unknown[]) { c.buf++; return (ob as any).apply(this, a) }
    OscillatorNode.prototype.start = function (...a: unknown[]) { c.osc++; return (oo as any).apply(this, a) }
    await new Promise(f => setTimeout(f, ms))
    AudioBufferSourceNode.prototype.start = ob
    OscillatorNode.prototype.start = oo
    return c
  }, ms)
}

test('the default drum track actually plays samples', async ({ page }) => {
  test.setTimeout(90_000)
  await roomWithTrackA(page)
  await page.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()
  await expect(page.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('You')
  await page.locator('[data-testid="track-a"] [data-testid="play-stop-button"]').click()
  await expect(page.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toBeVisible()

  // Let the cycle boundary + sample fetch settle, then measure.
  await page.waitForTimeout(6000)
  const { buf } = await audioNodeStarts(page, 4000)
  expect(buf, "AudioBufferSourceNode.start() calls in 4s").toBeGreaterThan(8)
})

test('the default bass track actually plays a synth', async ({ page }) => {
  test.setTimeout(90_000)
  await roomWithTrackA(page)
  await page.locator('[data-testid="track-b"] [data-testid="claim-button"]').click()
  await expect(page.locator('[data-testid="track-b"] [data-testid="owner-badge"]')).toHaveText('You')
  await page.locator('[data-testid="track-b"] [data-testid="play-stop-button"]').click()
  await expect(page.locator('[data-testid="track-b"] [data-testid="playing-badge"]')).toBeVisible()

  await page.waitForTimeout(6000)
  const { osc } = await audioNodeStarts(page, 4000)
  expect(osc, "OscillatorNode.start() calls in 4s").toBeGreaterThan(4)
})
