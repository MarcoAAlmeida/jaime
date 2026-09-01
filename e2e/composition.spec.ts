import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// add-composition-room — one shared Strudel document per room, merged
// with Yjs + y-codemirror.next. This file covers concurrent-edit
// convergence (task 2.4); roles / cursors / synced playback / chat land
// in later tasks (4.5 extends it).
test.describe.configure({ retries: 2 })

const CONTENT = '[data-testid="composition-editor"] .cm-content'

async function joinRoom(context: BrowserContext, roomId: string, name: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`/app/composition/${roomId}`)
  await page.locator('[data-testid="display-name-input"]').fill(name)
  await page.locator('[data-testid="submit-name-button"]').click()
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
