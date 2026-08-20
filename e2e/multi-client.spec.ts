import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    __jaimeClock?: { getOffset: () => number, hasEstimatedOnce: () => boolean }
  }
}

async function waitForOffsetEstimate(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__jaimeClock?.hasEstimatedOnce() === true, { timeout: 15_000 })
}

test('claiming a track propagates ownership and pattern updates, rejects a non-owner edit', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto('/jam')
  await pageB.goto('/jam')

  await pageA.locator('[data-testid="track-drums"] [data-testid="claim-button"]').click()

  // B sees drums as owned by someone else, with no claim control offered
  await expect(pageB.locator('[data-testid="track-drums"] [data-testid="owner-badge"]')).toHaveText('Owned')
  await expect(pageB.locator('[data-testid="track-drums"] [data-testid="claim-button"]')).toHaveCount(0)

  // Tracks start with a non-empty starter pattern — clear it first, or
  // typing appends to it instead of replacing it.
  await pageA.locator('[data-testid="track-drums"] .cm-content').click()
  await pageA.keyboard.press('ControlOrMeta+a')
  await pageA.keyboard.type('s("bd sd")')

  await expect(pageB.locator('[data-testid="track-drums"] .cm-content')).toHaveText('s("bd sd")')

  // B cannot edit a track it doesn't own: typing has no effect on the
  // shared content, even though the relay just proved the content path
  // works (the previous assertion already confirmed B receives updates).
  await pageB.locator('[data-testid="track-drums"] .cm-content').click()
  await pageB.keyboard.type('should not appear')
  await expect(pageB.locator('[data-testid="track-drums"] .cm-content')).toHaveText('s("bd sd")')

  await contextA.close()
  await contextB.close()
})

test('play/stop is broadcast to every client, and local mute is independent per client', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto('/jam')
  await pageB.goto('/jam')

  await pageA.locator('[data-testid="track-drums"] [data-testid="claim-button"]').click()
  await expect(pageB.locator('[data-testid="track-drums"] [data-testid="owner-badge"]')).toHaveText('Owned')

  // B never owns drums, but the play/stop broadcast still reaches it —
  // this is the core fix: everyone hears every track, not just the owner.
  await pageA.locator('[data-testid="track-drums"] [data-testid="play-button"]').click()
  await expect(pageA.locator('[data-testid="track-drums"] [data-testid="playing-badge"]')).toBeVisible()
  await expect(pageB.locator('[data-testid="track-drums"] [data-testid="playing-badge"]')).toBeVisible()

  // B's local mute is a personal listening preference — it must not
  // affect A's (or the room's) shared isPlaying state.
  await pageB.locator('[data-testid="track-drums"] [data-testid="mute-switch"]').click()
  await expect(pageB.locator('[data-testid="track-drums"] [data-testid="playing-badge"]')).toBeVisible()
  await expect(pageA.locator('[data-testid="track-drums"] [data-testid="playing-badge"]')).toBeVisible()

  await pageA.locator('[data-testid="track-drums"] [data-testid="stop-button"]').click()
  await expect(pageA.locator('[data-testid="track-drums"] [data-testid="playing-badge"]')).toHaveCount(0)
  await expect(pageB.locator('[data-testid="track-drums"] [data-testid="playing-badge"]')).toHaveCount(0)

  await contextA.close()
  await contextB.close()
})

test('clock offsets from two contexts stay within tolerance after correction', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto('/jam')
  await pageB.goto('/jam')

  // estimateOffset() runs automatically on room_state (connect) but is
  // async — wait for it to actually resolve rather than guessing a delay.
  await waitForOffsetEstimate(pageA)
  await waitForOffsetEstimate(pageB)

  const offsetA = await pageA.evaluate(() => window.__jaimeClock!.getOffset())
  const offsetB = await pageB.evaluate(() => window.__jaimeClock!.getOffset())

  // Both contexts run on the same machine (same real system clock), so
  // their independently-estimated offsets should agree closely — any
  // difference is measurement noise from the ping/pong round trip, not
  // genuine clock skew.
  expect(Math.abs(offsetA - offsetB)).toBeLessThan(20)

  await contextA.close()
  await contextB.close()
})

test('clock offset correction holds under simulated network jitter', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const cdpA = await contextA.newCDPSession(pageA)
  const cdpB = await contextB.newCDPSession(pageB)
  await cdpA.send('Network.enable')
  await cdpB.send('Network.enable')
  // Asymmetric, non-trivial latency on each context — real jitter, not
  // near-zero localhost latency.
  await cdpA.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 80,
    downloadThroughput: (750 * 1024) / 8,
    uploadThroughput: (250 * 1024) / 8,
  })
  await cdpB.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 30,
    downloadThroughput: (1.5 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })

  await pageA.goto('/jam')
  await pageB.goto('/jam')

  await waitForOffsetEstimate(pageA)
  await waitForOffsetEstimate(pageB)

  const offsetA = await pageA.evaluate(() => window.__jaimeClock!.getOffset())
  const offsetB = await pageB.evaluate(() => window.__jaimeClock!.getOffset())

  // Wider tolerance than the baseline test: asymmetric one-way latency is
  // exactly what half-round-trip estimation can't fully correct for, so
  // some extra measurement noise under real jitter is expected, not a bug.
  expect(Math.abs(offsetA - offsetB)).toBeLessThan(50)

  await contextA.close()
  await contextB.close()
})
