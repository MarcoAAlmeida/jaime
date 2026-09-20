import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// add-composition-room — one shared Strudel document per room, merged
// with Yjs + y-codemirror.next: concurrent-edit convergence, editor /
// viewer roles, live cursors, room-synced playback, ephemeral chat.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })
test.describe.configure({ retries: 2 })

const CONTENT = '[data-testid="composition-editor"] .cm-content'
const CANVAS = '[data-testid="composition-canvas"]'

/** Pixels painted on a page's editor-backdrop canvas (see strudel-parity.spec.ts). */
async function paintedPixels(page: Page): Promise<number> {
  return page.evaluate((sel) => {
    const c = document.querySelector(sel) as HTMLCanvasElement | null
    if (!c) return -1
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
    let n = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) n++
    return n
  }, CANVAS)
}

/** Replaces the whole document with `code` (an editor page only). */
async function setDoc(page: Page, code: string): Promise<void> {
  await page.locator(CONTENT).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(code)
}

async function joinRoom(
  context: BrowserContext,
  roomId: string,
  name: string,
  role: 'editor' | 'viewer' = 'editor',
): Promise<Page> {
  const page = await context.newPage()
  // Editor is the automatic default now (simplify-room-entry) — no
  // button to click. ?role=viewer keeps the viewer path reachable for
  // this test without any UI leading to it.
  const query = role === 'viewer' ? '?role=viewer' : ''
  await page.goto(`/app/composition/${roomId}${query}`)
  await page.locator('[data-testid="display-name-input"]').fill(name)
  await page.locator('[data-testid="submit-name-button"]').click()
  await expect(page.locator('[data-testid="display-name-input"]')).toHaveCount(0)
  // Chat is the default landing tab (add-jah-chat); most of this suite
  // exercises the editor, so switch there once, centrally, rather than
  // repeating it in every test. The default-tab behavior itself has
  // its own dedicated coverage below.
  await openTab(page, 'composition')
  // Editor is mounted once the CodeMirror content node exists. A fresh
  // page pays the same cold-start cost as JAM's editor (dynamic import +
  // the dirt-samples fetch) — see strudel-parity.spec.ts.
  await expect(page.locator(CONTENT)).toBeVisible({ timeout: 60_000 })
  return page
}

/** Selects all + deletes, so both editors start from a known empty doc. */
async function clearDoc(page: Page): Promise<void> {
  await page.locator(CONTENT).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
}

/** Switches tabs — matches whichever placement (header vs. mobile bottom
 *  bar) is visible at the current viewport (add-composition-tabs). */
async function openTab(page: Page, tab: 'composition' | 'chat' | 'ascii'): Promise<void> {
  await page.locator(`[data-testid="tab-${tab}"]:visible, [data-testid="tab-mobile-${tab}"]:visible`).click()
}

/**
 * The actual document text, excluding y-codemirror.next's remote-cursor
 * widgets — a peer's caret renders a `cm-ySelectionCaret` span carrying
 * their name (`cm-ySelectionInfo`) inline in `.cm-content`, so a plain
 * `textContent`/`toHaveText` read picks up "Alice" etc. as if it were
 * part of the shared document.
 */
async function docText(page: Page): Promise<string> {
  return page.locator(CONTENT).evaluate((content) => {
    const lines = Array.from(content.querySelectorAll('.cm-line'))
    return lines.map((line) => {
      const clone = line.cloneNode(true) as HTMLElement
      clone.querySelectorAll('.cm-ySelectionCaret').forEach(el => el.remove())
      return clone.textContent ?? ''
    }).join('\n')
  })
}

test('the sidebar links to the real room; create + join-by-link land in the same room', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()
  const pageA = await context.newPage()

  // Sidebar entry for Composition Room is a live link (no "Soon" badge).
  await pageA.goto('/app/jam')
  const navLink = pageA.getByRole('navigation').getByRole('link', { name: 'Composition Room' })
  await expect(navLink).toBeVisible()
  await navLink.click()
  await expect(pageA).toHaveURL(/\/app\/composition$/)

  await pageA.getByTestId('create-room-button').click()
  await expect(pageA).toHaveURL(/\/app\/composition\/[\w-]+$/)
  const roomUrl = pageA.url()
  await pageA.getByTestId('display-name-input').fill('Alice')
  await pageA.getByTestId('submit-name-button').click()
  await openTab(pageA, 'composition') // Chat is the default landing tab (add-jah-chat)
  await expect(pageA.locator(CONTENT)).toBeVisible({ timeout: 60_000 })

  // B joins by pasting the link into the join box.
  const pageB = await context.newPage()
  await pageB.goto('/app/composition')
  await pageB.getByTestId('join-code-input').fill(roomUrl)
  await pageB.getByTestId('join-room-button').click()
  await expect(pageB).toHaveURL(roomUrl)
  await pageB.getByTestId('display-name-input').fill('Bob')
  await pageB.getByTestId('submit-name-button').click()
  await openTab(pageB, 'composition')
  await expect(pageB.locator(CONTENT)).toBeVisible({ timeout: 60_000 })

  await setDoc(pageA, 'shared("here")')
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('shared("here")')

  await context.close()
})

test('concurrent inserts at different positions both survive and converge', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `conv-${Date.now()}`, 'Alice')
  const roomUrl = pageA.url()
  const roomId = new URL(roomUrl).pathname.split('/').pop()!
  const pageB = await joinRoom(context, roomId, 'Bob')

  await clearDoc(pageA)
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('')

  // A seeds a middle marker both sides agree on, then each appends at a
  // different end at the same time.
  await pageA.locator(CONTENT).click()
  await pageA.keyboard.insertText('MID')
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('MID')

  await Promise.all([
    (async () => {
      await pageA.locator(CONTENT).click()
      await pageA.keyboard.press('ControlOrMeta+Home')
      await pageA.keyboard.insertText('AAA')
    })(),
    (async () => {
      await pageB.locator(CONTENT).click()
      await pageB.keyboard.press('ControlOrMeta+End')
      await pageB.keyboard.insertText('BBB')
    })(),
  ])

  await expect.poll(() => docText(pageA), { timeout: 15_000 }).toBe('AAAMIDBBB')
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('AAAMIDBBB')

  await context.close()
})

test('a late joiner loads the current shared document', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `late-${Date.now()}`, 'Alice')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!

  await clearDoc(pageA)
  await pageA.locator(CONTENT).click()
  await pageA.keyboard.insertText('s("bd sd")')

  const pageB = await joinRoom(context, roomId, 'Bob')
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('s("bd sd")')

  await context.close()
})

test('local unsent edits are rebased over a remote change, losing neither', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `rebase-${Date.now()}`, 'Alice')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!
  const pageB = await joinRoom(context, roomId, 'Bob')

  await clearDoc(pageA)
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('')

  await pageA.locator(CONTENT).click()
  await pageA.keyboard.insertText('hello world')
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('hello world')

  // Both edit different words at the same time: A prepends, B appends.
  await Promise.all([
    (async () => {
      await pageA.locator(CONTENT).click()
      await pageA.keyboard.press('ControlOrMeta+Home')
      await pageA.keyboard.insertText('[A] ')
    })(),
    (async () => {
      await pageB.locator(CONTENT).click()
      await pageB.keyboard.press('ControlOrMeta+End')
      await pageB.keyboard.insertText(' [B]')
    })(),
  ])

  await expect.poll(() => docText(pageA), { timeout: 15_000 }).toBe('[A] hello world [B]')
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('[A] hello world [B]')

  await context.close()
})

test('the roster shows every participant and their role, and updates on leave', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `roster-${Date.now()}`, 'Alice', 'editor')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!
  const pageB = await joinRoom(context, roomId, 'Bob', 'viewer')

  for (const page of [pageA, pageB]) {
    const rows = page.locator('[data-testid="participant"]')
    await expect(rows).toHaveCount(2)
    await expect(rows.filter({ hasText: 'Alice' })).toContainText('editor')
    await expect(rows.filter({ hasText: 'Bob' })).toContainText('viewer')
  }

  await pageB.close()
  await expect(pageA.locator('[data-testid="participant"]')).toHaveCount(1)
  await expect(pageA.locator('[data-testid="participant"]')).toContainText('Alice')

  await context.close()
})

test('a viewer cannot edit the document, and has no way to become an editor in-room', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `viewer-${Date.now()}`, 'Alice', 'editor')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!
  const pageV = await joinRoom(context, roomId, 'Val', 'viewer')

  await clearDoc(pageA)
  await pageA.locator(CONTENT).click()
  await pageA.keyboard.insertText('editor-only')
  await expect.poll(() => docText(pageV), { timeout: 15_000 }).toBe('editor-only')

  // A viewer has no Play button, cannot type, and has no in-room
  // control to become an editor — role is fixed for the session
  // (refactor-composition-header).
  await expect(pageV.locator('[data-testid="play-stop-button"]')).toHaveCount(0)
  await expect(pageV.locator('[data-testid="toggle-role-button"]')).toHaveCount(0)
  await pageV.locator(CONTENT).click()
  await pageV.keyboard.type('SNEAKY')
  await pageV.waitForTimeout(500)
  await expect.poll(() => docText(pageV)).toBe('editor-only')
  await expect.poll(() => docText(pageA)).toBe('editor-only')

  await context.close()
})

test('editors see each other\'s live cursor, labelled by name', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `cursor-${Date.now()}`, 'Alice', 'editor')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!
  const pageB = await joinRoom(context, roomId, 'Bob', 'editor')

  await clearDoc(pageA)
  await pageA.locator(CONTENT).click()
  await pageA.keyboard.insertText('one two three')
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('one two three')

  // A moves; B should see A's caret widget carrying A's name.
  await pageA.locator(CONTENT).click()
  await pageA.keyboard.press('ControlOrMeta+Home')
  await expect(
    pageB.locator('[data-testid="composition-editor"] .cm-ySelectionInfo').filter({ hasText: 'Alice' }),
  ).toBeAttached({ timeout: 15_000 })

  // When A leaves, the caret goes with them.
  await pageA.close()
  await expect(
    pageB.locator('[data-testid="composition-editor"] .cm-ySelectionCaret'),
  ).toHaveCount(0, { timeout: 15_000 })

  await context.close()
})

test('one editor evaluates and the whole room — editor and viewer — plays it', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `play-${Date.now()}`, 'Alice', 'editor')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!
  const pageB = await joinRoom(context, roomId, 'Bob', 'editor')
  const pageV = await joinRoom(context, roomId, 'Val', 'viewer')

  await setDoc(pageA, 's("bd sd hh cp").punchcard()')
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('s("bd sd hh cp").punchcard()')

  await pageA.locator('[data-testid="play-stop-button"]').click()

  // The other editor's transport flips too, and every client — including
  // the viewer, who has no Play button — actually evaluates: its
  // backdrop canvas paints.
  await expect(pageB.locator('[data-testid="play-stop-button"]')).toHaveText('Stop', { timeout: 15_000 })
  for (const page of [pageA, pageB, pageV]) {
    await expect.poll(() => paintedPixels(page), { timeout: 45_000 }).toBeGreaterThan(500)
  }

  await pageA.locator('[data-testid="play-stop-button"]').click()
  await expect(pageB.locator('[data-testid="play-stop-button"]')).toHaveText('Play', { timeout: 15_000 })

  await context.close()
})

test('a late joiner starts playing the running document with no re-trigger', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `latejoin-${Date.now()}`, 'Alice', 'editor')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!

  await setDoc(pageA, 's("bd*4, hh*8").punchcard()')
  await pageA.locator('[data-testid="play-stop-button"]').click()
  await expect.poll(() => paintedPixels(pageA), { timeout: 45_000 }).toBeGreaterThan(500)

  // C opens the link while the room is playing — no one clicks Play again.
  const pageC = await joinRoom(context, roomId, 'Cara', 'viewer')
  await expect.poll(() => paintedPixels(pageC), { timeout: 45_000 }).toBeGreaterThan(500)

  await context.close()
})

test('a pattern error shows for everyone and the engine still evaluates next', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `err-${Date.now()}`, 'Alice', 'editor')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!
  const pageB = await joinRoom(context, roomId, 'Bob', 'editor')

  await setDoc(pageA, 's("bd sd"') // unbalanced paren
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('s("bd sd"')
  await pageA.locator('[data-testid="play-stop-button"]').click()

  for (const page of [pageA, pageB]) {
    await expect(page.getByText('Pattern error')).toBeVisible({ timeout: 20_000 })
  }

  // A valid document evaluates fine afterwards — the engine is not
  // wedged. Ctrl-Enter re-evaluates in place (the transport is still
  // "playing" from the errored attempt).
  await setDoc(pageA, 's("bd sd hh cp").punchcard()')
  await pageA.locator(CONTENT).press('ControlOrMeta+Enter')
  await expect.poll(() => paintedPixels(pageB), { timeout: 45_000 }).toBeGreaterThan(500)
  await expect(pageA.getByText('Pattern error')).toHaveCount(0)

  await context.close()
})

test('a chat message reaches everyone; chat is gone once the room empties', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `chat-${Date.now()}`, 'Alice', 'editor')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!
  const pageB = await joinRoom(context, roomId, 'Bob', 'viewer')

  await setDoc(pageA, 's("bd sd")')
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('s("bd sd")')

  await openTab(pageA, 'chat')
  await pageA.locator('[data-testid="chat-input"]').fill('hey room')
  await pageA.locator('[data-testid="chat-send"]').click()

  for (const page of [pageA, pageB]) {
    // Presence, not visibility — pageB hasn't switched to the Chat tab
    // itself, but the message still reached it (chat-panel is hidden
    // via v-show, not removed from the DOM).
    await expect(
      page.locator('[data-testid="chat-message-row"]').filter({ hasText: 'hey room' }),
    ).toHaveCount(1, { timeout: 15_000 })
  }
  // Bob sees who said it (the name is in the header for others' messages);
  // Alice's own message carries no name (uplift-chat-interface).
  await expect(
    pageB.locator('[data-testid="chat-message-row"]').filter({ hasText: 'hey room' }),
  ).toContainText('Alice')

  // Let the doc snapshot debounce (2s) land, then everyone leaves.
  await pageA.waitForTimeout(2500)
  await pageA.close()
  await pageB.close()
  await context.close()

  // A fresh visitor (new context = no stored name) opens the same link:
  // the persisted document is back, the ephemeral chat is not — Alice's
  // message is gone, leaving only @jah's welcome (add-jah-chat), reset
  // and re-posted since the room's chat is empty again.
  const context2 = await browser.newContext()
  const pageC = await joinRoom(context2, roomId, 'Cara', 'viewer')
  await expect.poll(() => docText(pageC), { timeout: 15_000 }).toBe('s("bd sd")')
  await expect(pageC.locator('[data-testid="chat-message-row"]').filter({ hasText: 'hey room' })).toHaveCount(0)
  await expect(pageC.locator('[data-testid="chat-message-row"][data-role="assistant"]')).toHaveCount(1)

  await context2.close()
})

test('three separate clients — two editors + a viewer — edit, cursor, hear, and chat together', async ({ browser }) => {
  test.setTimeout(240_000)

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const ctxV = await browser.newContext()

  const pageA = await joinRoom(ctxA, `trio-${Date.now()}`, 'Ann', 'editor')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!
  const pageB = await joinRoom(ctxB, roomId, 'Ben', 'editor')
  const pageV = await joinRoom(ctxV, roomId, 'Vic', 'viewer')

  // Everyone sees the full roster with roles.
  for (const page of [pageA, pageB, pageV]) {
    await expect(page.locator('[data-testid="participant"]')).toHaveCount(3, { timeout: 15_000 })
  }

  // Two editors type concurrently; all three converge.
  await clearDoc(pageA)
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('')
  await pageA.locator(CONTENT).click()
  await pageA.keyboard.insertText('s("bd sd hh cp").punchcard()')
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe('s("bd sd hh cp").punchcard()')

  await Promise.all([
    (async () => {
      await pageA.locator(CONTENT).click()
      await pageA.keyboard.press('ControlOrMeta+End')
      await pageA.keyboard.insertText('\n// ann')
    })(),
    (async () => {
      await pageB.locator(CONTENT).click()
      await pageB.keyboard.press('ControlOrMeta+End')
      await pageB.keyboard.insertText('\n// ben')
    })(),
  ])
  await expect.poll(() => docText(pageA), { timeout: 15_000 }).toBe(await docText(pageV))
  await expect.poll(() => docText(pageB), { timeout: 15_000 }).toBe(await docText(pageV))

  // Ben sees Ann's caret, labelled.
  await pageA.locator(CONTENT).click()
  await pageA.keyboard.press('ControlOrMeta+Home')
  await expect(
    pageB.locator('[data-testid="composition-editor"] .cm-ySelectionInfo').filter({ hasText: 'Ann' }),
  ).toBeAttached({ timeout: 15_000 })

  // Ann evaluates; all three (viewer included) paint the backdrop.
  await pageA.locator('[data-testid="play-stop-button"]').click()
  for (const page of [pageA, pageB, pageV]) {
    await expect.poll(() => paintedPixels(page), { timeout: 45_000 }).toBeGreaterThan(500)
  }

  // Chat from the viewer reaches both editors.
  await openTab(pageV, 'chat')
  await pageV.locator('[data-testid="chat-input"]').fill('sounds good')
  await pageV.locator('[data-testid="chat-send"]').click()
  for (const page of [pageA, pageB]) {
    // Presence, not visibility — neither has switched to the Chat tab.
    await expect(
      page.locator('[data-testid="chat-message-row"]').filter({ hasText: 'sounds good' }),
    ).toContainText('Vic', { timeout: 15_000 })
  }

  await ctxA.close()
  await ctxB.close()
  await ctxV.close()
})

test('scope() visuals stay inside the editor pane, not a full-viewport canvas', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()
  const pageA = await joinRoom(context, `scope-${Date.now()}`, 'Alice', 'editor')

  await setDoc(pageA, 's("sawtooth").gain(.7).scope()')
  await pageA.locator('[data-testid="play-stop-button"]').click()

  // The oscilloscope actually renders...
  await expect.poll(() => paintedPixels(pageA), { timeout: 45_000 }).toBeGreaterThan(200)

  // ...onto the editor's own backdrop canvas — not a stray
  // position:fixed <canvas> bolted onto <body> by @strudel/draw.
  const strayCanvas = await pageA.evaluate(() => {
    const pane = document.querySelector('[data-testid="composition-editor"]')
    return [...document.querySelectorAll('canvas')].some((c) => {
      if (pane?.contains(c)) return false
      return getComputedStyle(c).position === 'fixed'
    })
  })
  expect(strayCanvas).toBe(false)

  await context.close()
})

test('Composition, Chat, and ASCII Art tabs are mutually exclusive on a narrow screen', async ({ browser }) => {
  test.setTimeout(180_000)
  // `joinRoom` switches to the Composition tab via the desktop
  // switcher, which is hidden below `md` — join at the default
  // (desktop) viewport, then resize down for the narrow-screen checks.
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `panel-${Date.now()}`, 'Alice', 'editor')
  await pageA.setViewportSize({ width: 740, height: 400 }) // landscape phone

  const editor = pageA.locator('[data-testid="composition-editor"]')
  const chatPanel = pageA.locator('[data-testid="chat-panel"]')

  // Composition is where `joinRoom` left us; the header switcher is
  // hidden at this width (`md:flex`) — the bottom bar is what's
  // reachable.
  await expect(editor).toBeVisible()
  await expect(chatPanel).toBeHidden()

  await pageA.locator('[data-testid="tab-mobile-chat"]').click()
  await expect(chatPanel).toBeVisible()
  await expect(pageA.locator('[data-testid="chat-input"]')).toBeVisible()
  await expect(editor).toBeHidden()

  await pageA.locator('[data-testid="tab-mobile-composition"]').click()
  await expect(editor).toBeVisible()
  await expect(chatPanel).toBeHidden()

  await pageA.locator('[data-testid="tab-mobile-chat"]').click()
  await expect(chatPanel).toBeVisible()
  await expect(editor).toBeHidden()

  await context.close()
})

test('an editor loads a starter composition into the shared document for everyone', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `preset-${Date.now()}`, 'Alice', 'editor')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!
  const pageV = await joinRoom(context, roomId, 'Val', 'viewer')

  // A viewer has no way to load one.
  await expect(pageV.locator('[data-testid="load-preset-button"]')).toHaveCount(0)

  await pageA.locator('[data-testid="load-preset-button"]').click()
  await pageA.getByRole('option', { name: /Birds of a Feather/ }).click()

  // The whole script replaces the shared doc, on the loader's editor and
  // on the viewer's.
  for (const page of [pageA, pageV]) {
    await expect.poll(() => docText(page), { timeout: 15_000 }).toContain('BIRDS OF A FEATHER')
    await expect.poll(() => docText(page)).toContain('$:arrange(')
  }

  // The picker resets after a pick, so its trigger shows the placeholder
  // again rather than looking like a persistent "selected starter" control.
  await expect(pageA.locator('[data-testid="load-preset-button"]')).toContainText('Load a starter')

  // And it evaluates without a pattern error — its gm_* voices, the
  // LinnDrum / TR808 banks, and s_polymeter / arrange all resolve.
  await pageA.locator(CONTENT).click()
  await pageA.keyboard.press('ControlOrMeta+Enter')
  await pageA.waitForTimeout(6000)
  await expect(pageA.locator('[data-testid="composition-editor"]').getByText('Pattern error')).toHaveCount(0)

  await context.close()
})
