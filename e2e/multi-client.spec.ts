import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    __jaimeClock?: { getOffset: () => number, hasEstimatedOnce: () => boolean }
  }
}

async function waitForOffsetEstimate(page: Page) {
  await page.waitForFunction(() => window.__jaimeClock?.hasEstimatedOnce() === true, { timeout: 15_000 })
}

/** Creates a fresh room via the real landing-page UI and returns its ID. */
async function createRoom(page: Page): Promise<string> {
  await page.goto('/')
  await page.locator('[data-testid="create-room-button"]').click()
  await page.waitForURL(/\/room\//)
  return new URL(page.url()).pathname.split('/').pop()!
}

test('creating a room and joining it by pasting the link land two clients in the same room', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto('/')
  await pageA.locator('[data-testid="create-room-button"]').click()
  await pageA.waitForURL(/\/room\//)
  const roomUrl = pageA.url()

  // B joins through the actual join UI (pasting the link), not by
  // navigating straight to the URL — this is the one test that exercises
  // that path end to end; every other multi-client test below joins a
  // shared room by direct navigation since it isn't what they're testing.
  await pageB.goto('/')
  await pageB.locator('[data-testid="join-code-input"]').fill(roomUrl)
  await pageB.locator('[data-testid="join-room-button"]').click()
  await pageB.waitForURL(/\/room\//)

  expect(pageB.url()).toBe(roomUrl)

  await pageA.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('Owned')

  await contextA.close()
  await contextB.close()
})

test('two separately created rooms never see each other\'s activity', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await createRoom(pageA)
  await createRoom(pageB)

  await pageA.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()
  await expect(pageA.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('You')

  // B's independently created room never hears about A's claim.
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('Unclaimed')
  await expect(pageB.locator('[data-testid="presence-count"]')).toHaveText('1 here')

  await contextA.close()
  await contextB.close()
})

test('presence count updates as a second client joins and leaves the same room', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const roomId = await createRoom(pageA)
  await expect(pageA.locator('[data-testid="presence-count"]')).toHaveText('1 here')

  await pageB.goto(`/room/${roomId}`)
  await expect(pageA.locator('[data-testid="presence-count"]')).toHaveText('2 here')
  await expect(pageB.locator('[data-testid="presence-count"]')).toHaveText('2 here')

  await contextB.close()
  await expect(pageA.locator('[data-testid="presence-count"]')).toHaveText('1 here')

  await contextA.close()
})

test('claiming a track propagates ownership and pattern updates, rejects a non-owner edit', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const roomId = await createRoom(pageA)
  await pageB.goto(`/room/${roomId}`)

  await pageA.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()

  // B sees track A as owned by someone else, with no claim control offered
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('Owned')
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="claim-button"]')).toHaveCount(0)

  // Tracks start with a non-empty starter pattern — clear it first, or
  // typing appends to it instead of replacing it.
  await pageA.locator('[data-testid="track-a"] .cm-content').click()
  await pageA.keyboard.press('ControlOrMeta+a')
  await pageA.keyboard.type('s("bd sd")')

  await expect(pageB.locator('[data-testid="track-a"] .cm-content')).toHaveText('s("bd sd")')

  // B cannot edit a track it doesn't own: typing has no effect on the
  // shared content, even though the relay just proved the content path
  // works (the previous assertion already confirmed B receives updates).
  await pageB.locator('[data-testid="track-a"] .cm-content').click()
  await pageB.keyboard.type('should not appear')
  await expect(pageB.locator('[data-testid="track-a"] .cm-content')).toHaveText('s("bd sd")')

  await contextA.close()
  await contextB.close()
})

test('play/stop is broadcast to every client, and local mute is independent per client', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const roomId = await createRoom(pageA)
  await pageB.goto(`/room/${roomId}`)

  await pageA.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('Owned')

  const playStopButton = pageA.locator('[data-testid="track-a"] [data-testid="play-stop-button"]')

  // B never owns track A, but the play/stop broadcast still reaches it —
  // this is the core fix: everyone hears every track, not just the owner.
  await playStopButton.click()
  await expect(playStopButton).toHaveText('Stop')
  await expect(pageA.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toBeVisible()
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toBeVisible()

  // B's local mute is a personal listening preference — it must not
  // affect A's (or the room's) shared isPlaying state.
  await pageB.locator('[data-testid="track-a"] [data-testid="mute-switch"]').click()
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toBeVisible()
  await expect(pageA.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toBeVisible()

  await playStopButton.click()
  await expect(playStopButton).toHaveText('Play')
  await expect(pageA.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toHaveCount(0)
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toHaveCount(0)

  await contextA.close()
  await contextB.close()
})

test('editing a playing track auto-stops it for every client', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const roomId = await createRoom(pageA)
  await pageB.goto(`/room/${roomId}`)

  await pageA.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('Owned')

  await pageA.locator('[data-testid="track-a"] [data-testid="play-stop-button"]').click()
  await expect(pageA.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toBeVisible()
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toBeVisible()

  await pageA.locator('[data-testid="track-a"] .cm-content').click()
  await pageA.keyboard.press('ControlOrMeta+a')
  await pageA.keyboard.type('s("hh*8")')

  // Editing while playing auto-stops the track for everyone, rather than
  // silently hot-swapping the running pattern — so the visible code and
  // the audible (or in this test, the badge-reported) state never
  // disagree about what's actually playing.
  await expect(pageA.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toHaveCount(0)
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="playing-badge"]')).toHaveCount(0)
  await expect(pageA.locator('[data-testid="track-a"] [data-testid="play-stop-button"]')).toHaveText('Play')
  await expect(pageB.locator('[data-testid="track-a"] .cm-content')).toHaveText('s("hh*8")')

  await contextA.close()
  await contextB.close()
})

test('a joining client sees an audio-unlock prompt until it interacts with the page', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  await createRoom(page)

  // Browsers block audio until a genuine user gesture, including the
  // automatic evaluate() this page fires for a track that's already
  // playing when it joins — the prompt is what tells the user that's
  // why they aren't hearing anything yet, instead of leaving it silent
  // and unexplained.
  await expect(page.locator('[data-testid="audio-unlock-banner"]')).toBeVisible()

  await page.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()

  await expect(page.locator('[data-testid="audio-unlock-banner"]')).toHaveCount(0)

  await context.close()
})

test('clock offsets from two contexts stay within tolerance after correction', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const roomId = await createRoom(pageA)
  await pageB.goto(`/room/${roomId}`)

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

  const roomId = await createRoom(pageA)
  await pageB.goto(`/room/${roomId}`)

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
