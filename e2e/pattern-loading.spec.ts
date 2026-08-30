import { expect, test } from '@playwright/test'

// pattern-library + room-lifecycle deltas — "Load into JAM" seeds the
// loader's track A, and a later joiner of the (clean) room link is not
// re-seeded.

async function join(page: import('@playwright/test').Page, name: string) {
  await page.locator('[data-testid="display-name-input"]').fill(name)
  await page.locator('[data-testid="submit-name-button"]').click()
  await expect(page.locator('[data-testid="display-name-input"]')).toHaveCount(0)
}

test('loading a pattern into JAM seeds track A; a later joiner is not seeded', async ({ browser }) => {
  test.setTimeout(60_000)

  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()

  await pageA.goto('/app/patterns')
  await pageA.getByRole('button', { name: /^Four on the floor\b/ }).first().click()
  await pageA.getByTestId('load-into-jam').click()

  await pageA.waitForURL(/\/app\/jam\/room\//)
  await join(pageA, 'Alice')

  // Track A gets the pattern's code and is claimed for the loader.
  const editorA = pageA.locator('[data-testid="track-a"] .cm-content')
  await expect(editorA).toContainText('bd*4')
  await expect(pageA.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('You')

  // ?load has been stripped — the address bar / invite link is clean.
  await expect(pageA).toHaveURL(/\/app\/jam\/room\/[^?]+$/)
  const roomUrl = pageA.url()

  // A second client joins that clean link.
  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await pageB.goto(roomUrl)
  await join(pageB, 'Bob')

  // Bob sees track A's loaded code (broadcast on seed)...
  await expect(pageB.locator('[data-testid="track-a"] .cm-content')).toContainText('bd*4')
  // ...but his own track B is untouched — still the default starter.
  const editorB = pageB.locator('[data-testid="track-b"] .cm-content')
  await expect(editorB).toContainText('c2')
  await expect(editorB).not.toContainText('bd*4')

  await ctxA.close()
  await ctxB.close()
})

test('a stale ?load link on a room with track A taken does not re-seed', async ({ browser }) => {
  test.setTimeout(60_000)

  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  await pageA.goto('/app/patterns')
  await pageA.getByRole('button', { name: /^Acid line\b/ }).first().click()
  await pageA.getByTestId('load-into-jam').click()
  await pageA.waitForURL(/\/app\/jam\/room\//)
  await join(pageA, 'Alice')
  await expect(pageA.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('You')
  const roomId = new URL(pageA.url()).pathname.split('/').pop()!

  // Bob opens the SAME room with a stale ?load for a different pattern.
  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await pageB.goto(`/app/jam/room/${roomId}?load=seed-four-on-the-floor`)
  await join(pageB, 'Bob')

  await expect(pageB.locator('[data-testid="load-notice"]')).toBeVisible()
  // Track A is still Alice's Acid line, not overwritten with Four on the floor.
  await expect(pageB.locator('[data-testid="track-a"] .cm-content')).not.toContainText('bd*4')

  await ctxA.close()
  await ctxB.close()
})
