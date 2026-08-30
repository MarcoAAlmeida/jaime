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

/** Submits the room page's name-entry gate, revealing the room UI. */
async function joinWithName(page: Page, name: string) {
  await page.locator('[data-testid="display-name-input"]').fill(name)
  await page.locator('[data-testid="submit-name-button"]').click()
  await expect(page.locator('[data-testid="display-name-input"]')).toHaveCount(0)
}

/** Creates a fresh room via the real JAM entry point in the dashboard shell, sets a display name, and returns the room's ID. */
async function createRoom(page: Page, name = 'Player'): Promise<string> {
  await page.goto('/app/jam')
  // The dashboard shell hydrates after the `load` event, so a click
  // fired the instant the page loads can land on the not-yet-wired
  // button and do nothing (visible under the network-jitter test's
  // added latency). Retry the click until it actually navigates.
  await expect(async () => {
    await page.locator('[data-testid="create-room-button"]').click()
    await page.waitForURL(/\/app\/jam\/room\//, { timeout: 2000 })
  }).toPass({ timeout: 30_000 })
  await joinWithName(page, name)
  return new URL(page.url()).pathname.split('/').pop()!
}

/** Navigates directly to an existing room's URL and sets a display name. */
async function joinRoomById(page: Page, roomId: string, name: string) {
  await page.goto(`/app/jam/room/${roomId}`)
  await joinWithName(page, name)
}

test('creating a room and joining it by pasting the link land two clients in the same room', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto('/app/jam')
  await pageA.locator('[data-testid="create-room-button"]').click()
  await pageA.waitForURL(/\/app\/jam\/room\//)
  const roomUrl = pageA.url()
  await joinWithName(pageA, 'Alice')

  // B joins through the actual join UI (pasting the link), not by
  // navigating straight to the URL — this is the one test that exercises
  // that path end to end; every other multi-client test below joins a
  // shared room by direct navigation since it isn't what they're testing.
  await pageB.goto('/app/jam')
  await pageB.locator('[data-testid="join-code-input"]').fill(roomUrl)
  await pageB.locator('[data-testid="join-room-button"]').click()
  await pageB.waitForURL(/\/app\/jam\/room\//)
  await joinWithName(pageB, 'Bob')

  expect(pageB.url()).toBe(roomUrl)

  await pageA.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('Alice')

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

  await joinRoomById(pageB, roomId, 'Bob')
  await expect(pageA.locator('[data-testid="presence-count"]')).toHaveText('2 here')
  await expect(pageB.locator('[data-testid="presence-count"]')).toHaveText('2 here')

  await contextB.close()
  await expect(pageA.locator('[data-testid="presence-count"]')).toHaveText('1 here')

  await contextA.close()
})

test('presence and track ownership show each client\'s display name', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const roomId = await createRoom(pageA, 'Alice')
  await joinRoomById(pageB, roomId, 'Bob')

  await expect(pageA.locator('[data-testid="presence-names"]')).toHaveText('Alice, Bob')
  await expect(pageB.locator('[data-testid="presence-names"]')).toHaveText('Alice, Bob')

  await pageB.locator('[data-testid="track-b"] [data-testid="claim-button"]').click()
  await expect(pageA.locator('[data-testid="track-b"] [data-testid="owner-badge"]')).toHaveText('Bob')
  await expect(pageB.locator('[data-testid="track-b"] [data-testid="owner-badge"]')).toHaveText('You')

  await contextA.close()
  await contextB.close()
})

test('changing tempo updates the displayed BPM for every client', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const roomId = await createRoom(pageA)
  await joinRoomById(pageB, roomId, 'Bob')

  await expect(pageA.locator('[data-testid="bpm-input"]')).toHaveValue('120')
  await expect(pageB.locator('[data-testid="bpm-input"]')).toHaveValue('120')

  await pageA.locator('[data-testid="bpm-input"]').fill('140')
  await pageA.locator('[data-testid="set-tempo-button"]').click()

  await expect(pageB.locator('[data-testid="bpm-input"]')).toHaveValue('140')

  await contextA.close()
  await contextB.close()
})

test('claiming a track propagates ownership and pattern updates, rejects a non-owner edit', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const roomId = await createRoom(pageA, 'Alice')
  await joinRoomById(pageB, roomId, 'Bob')

  await pageA.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()

  // B sees track A as owned by someone else, with no claim control offered
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('Alice')
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
  await joinRoomById(pageB, roomId, 'Bob')

  await pageA.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('Player')

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
  await joinRoomById(pageB, roomId, 'Bob')

  await pageA.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()
  await expect(pageB.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('Player')

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

  // The join gate's own "Join" click now satisfies the browser's
  // audio-unlock gesture requirement before the room ever renders, so
  // the banner can't appear right after going through that gate anymore
  // — it only still matters on a page load where no click has happened
  // yet. Seed a display name via a first room (so its gate is behind
  // us), then do a genuine fresh navigation (page.goto, not an in-app
  // link) to a second room: the gate is skipped since a name already
  // exists in sessionStorage, so this page load's first click is
  // whatever the test does next, not one already spent on the gate.
  const firstRoomId = await createRoom(page)
  await page.goto(`/app/jam/room/${firstRoomId}-2`)

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
  await joinRoomById(pageB, roomId, 'Bob')

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
  // The dashboard shell + Strudel/CodeMirror room bundle is heavy enough
  // that even at broadband speeds two full page loads plus offset
  // estimation runs past the default 30s.
  test.setTimeout(90_000)

  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const cdpA = await contextA.newCDPSession(pageA)
  const cdpB = await contextB.newCDPSession(pageB)
  await cdpA.send('Network.enable')
  await cdpB.send('Network.enable')
  // Asymmetric, non-trivial latency on each context — real jitter, not
  // near-zero localhost latency. Throughput is left at broadband so the
  // test exercises latency asymmetry (what half-round-trip offset
  // estimation can't fully correct), not bandwidth starvation.
  await cdpA.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 80,
    downloadThroughput: (16 * 1024 * 1024) / 8,
    uploadThroughput: (8 * 1024 * 1024) / 8,
  })
  await cdpB.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 30,
    downloadThroughput: (24 * 1024 * 1024) / 8,
    uploadThroughput: (12 * 1024 * 1024) / 8,
  })

  const roomId = await createRoom(pageA)
  await joinRoomById(pageB, roomId, 'Bob')

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
