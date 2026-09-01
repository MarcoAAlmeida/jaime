import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// add-composition-room — one shared Strudel document per room, merged
// with Yjs + y-codemirror.next. This file covers concurrent-edit
// convergence (task 2.4); roles / cursors / synced playback / chat land
// in later tasks (4.5 extends it).
test.describe.configure({ retries: 2 })

const CONTENT = '[data-testid="composition-editor"] .cm-content'

async function joinRoom(
  context: BrowserContext,
  roomId: string,
  name: string,
  role: 'editor' | 'viewer' = 'editor',
): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`/app/composition/${roomId}`)
  await page.locator('[data-testid="display-name-input"]').fill(name)
  await page.locator('[data-testid="submit-name-button"]').click()
  await page.locator(`[data-testid="role-${role}"]`).click()
  await expect(page.locator('[data-testid="display-name-input"]')).toHaveCount(0)
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

test('a viewer cannot edit the document; switching to editor lets them', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext()

  const pageA = await joinRoom(context, `viewer-${Date.now()}`, 'Alice', 'editor')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!
  const pageV = await joinRoom(context, roomId, 'Val', 'viewer')

  await clearDoc(pageA)
  await pageA.locator(CONTENT).click()
  await pageA.keyboard.insertText('editor-only')
  await expect.poll(() => docText(pageV), { timeout: 15_000 }).toBe('editor-only')

  // A viewer has no Play button and cannot type.
  await expect(pageV.locator('[data-testid="play-stop-button"]')).toHaveCount(0)
  await pageV.locator(CONTENT).click()
  await pageV.keyboard.type('SNEAKY')
  await pageV.waitForTimeout(500)
  await expect.poll(() => docText(pageV)).toBe('editor-only')
  await expect.poll(() => docText(pageA)).toBe('editor-only')

  // Switching to editor makes their edits land for everyone, no rejoin.
  await pageV.locator('[data-testid="toggle-role-button"]').click()
  await expect(pageV.locator('[data-testid="play-stop-button"]')).toBeVisible()
  await pageV.locator(CONTENT).click()
  await pageV.keyboard.press('ControlOrMeta+End')
  await pageV.keyboard.type(' + viewer-now-editor')
  await expect.poll(() => docText(pageA), { timeout: 15_000 }).toBe('editor-only + viewer-now-editor')
  await expect(pageA.locator('[data-testid="participant"]').filter({ hasText: 'Val' })).toContainText('editor')

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
