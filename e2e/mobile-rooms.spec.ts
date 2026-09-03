import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// add-responsive-rooms — the JAM room and Composition Room work on a
// phone held vertically: header stays unobstructed, code reads without
// horizontal scroll, sharing is one action.
test.use({ viewport: { width: 375, height: 667 } }) // iPhone-ish portrait
test.describe.configure({ retries: 2 })

/** No horizontal page overflow. */
async function noSidewaysScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
}

/** The jaime logo is the top element at its own centre — nothing drawn over it. */
async function logoIsUncovered(page: Page) {
  return page.evaluate(() => {
    const logo = document.querySelector('[aria-label="jaime home"]')
    if (!logo) return false
    const r = logo.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return logo.contains(hit) || logo === hit
  })
}

/** The editor's scroller has no horizontal overflow — code reads without scrolling sideways. */
async function editorHasNoHorizontalScroll(page: Page, testid: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(`${sel} .cm-scroller`) as HTMLElement | null
    if (!el) return false
    return el.scrollWidth <= el.clientWidth + 1
  }, testid)
}

const LONG_LINE = 's("bd sd hh oh cp mt lt ht rim").fast(2).gain(0.8).lpf(1200).room(0.4).delay(0.25).pan(sine)'

test('JAM room: header unobstructed, code wraps, invite reachable', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/app/jam')
  await expect(async () => {
    await page.locator('[data-testid="create-room-button"]').click()
    await page.waitForURL(/\/app\/jam\/room\//, { timeout: 2000 })
  }).toPass({ timeout: 30_000 })
  await page.locator('[data-testid="display-name-input"]').fill('Mo')
  await page.locator('[data-testid="submit-name-button"]').click()
  await expect(page.locator('[data-testid="display-name-input"]')).toHaveCount(0)

  expect(await logoIsUncovered(page), 'logo not covered').toBe(true)
  expect(await noSidewaysScroll(page), 'no horizontal page scroll').toBe(true)
  await expect(page.locator('[data-testid="copy-invite-button"]')).toBeVisible()

  await page.locator('[data-testid="track-a"] [data-testid="claim-button"]').click()
  await expect(page.locator('[data-testid="track-a"] [data-testid="owner-badge"]')).toHaveText('You')
  await page.locator('[data-testid="track-a"] .cm-content').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(LONG_LINE)
  await expect.poll(() => editorHasNoHorizontalScroll(page, '[data-testid="track-a"]'), { timeout: 5000 })
    .toBe(true)
  expect(await noSidewaysScroll(page)).toBe(true)
})

test('Composition Room: header collapses to a menu, code wraps, share reachable', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto(`/app/composition/mob-${Date.now()}`)
  await page.locator('[data-testid="display-name-input"]').fill('Mo')
  await page.locator('[data-testid="submit-name-button"]').click()
  await page.locator('[data-testid="role-editor"]').click()
  await expect(page.locator('[data-testid="composition-editor"] .cm-content')).toBeVisible({ timeout: 60_000 })

  expect(await logoIsUncovered(page), 'logo not covered').toBe(true)
  expect(await noSidewaysScroll(page), 'no horizontal page scroll').toBe(true)

  // Secondary controls are folded away; the ⋯ menu is the way to them.
  await expect(page.locator('[data-testid="toggle-role-button"]')).toBeHidden()
  await expect(page.locator('[data-testid="room-overflow-menu"]')).toBeVisible()
  await page.locator('[data-testid="room-overflow-menu"]').click()
  await expect(page.getByRole('menuitem', { name: /Switch to viewer/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Load a starter/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Share|Copy invite link/ })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.locator('[data-testid="composition-editor"] .cm-content').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(LONG_LINE)
  await expect.poll(() => editorHasNoHorizontalScroll(page, '[data-testid="composition-editor"]'), { timeout: 5000 })
    .toBe(true)
  expect(await noSidewaysScroll(page)).toBe(true)
})

test('Composition Room: usable on a short landscape viewport', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 667, height: 375 }) // phone rotated
  await page.goto(`/app/composition/land-${Date.now()}`)
  await page.locator('[data-testid="display-name-input"]').fill('La')
  await page.locator('[data-testid="submit-name-button"]').click()
  await page.locator('[data-testid="role-editor"]').click()
  await expect(page.locator('[data-testid="composition-editor"] .cm-content')).toBeVisible({ timeout: 60_000 })

  expect(await logoIsUncovered(page), 'logo not covered').toBe(true)
  expect(await noSidewaysScroll(page), 'no horizontal page scroll').toBe(true)
  // The editor still has real height to work in (header hasn't eaten the screen).
  const editorHeight = (await page.locator('[data-testid="composition-editor"]').boundingBox())!.height
  expect(editorHeight).toBeGreaterThan(120)
})

test('Share uses the native share sheet when the device has one', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    ;(window as unknown as { __shared: unknown[] }).__shared = []
    // headless chromium has no navigator.share — stand one in
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data: unknown) => {
        ;(window as unknown as { __shared: unknown[] }).__shared.push(data)
        return Promise.resolve()
      },
    })
  })

  await page.goto('/app/jam')
  await expect(async () => {
    await page.locator('[data-testid="create-room-button"]').click()
    await page.waitForURL(/\/app\/jam\/room\//, { timeout: 2000 })
  }).toPass({ timeout: 30_000 })
  const roomUrl = page.url()
  await page.locator('[data-testid="display-name-input"]').fill('Sh')
  await page.locator('[data-testid="submit-name-button"]').click()

  const btn = page.locator('[data-testid="copy-invite-button"]')
  await expect(btn).toHaveText('Share')
  await btn.click()
  const shared = await page.evaluate(() => (window as unknown as { __shared: { url: string }[] }).__shared)
  expect(shared).toHaveLength(1)
  expect(shared[0]!.url).toBe(roomUrl)
})

test('Composition Room: at a wide viewport lines are not force-wrapped', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/app/composition/wide-${Date.now()}`)
  await page.locator('[data-testid="display-name-input"]').fill('Wide')
  await page.locator('[data-testid="submit-name-button"]').click()
  await page.locator('[data-testid="role-editor"]').click()
  await expect(page.locator('[data-testid="composition-editor"] .cm-content')).toBeVisible({ timeout: 60_000 })

  // The individual controls are inline (no overflow menu) at this width.
  await expect(page.locator('[data-testid="toggle-role-button"]')).toBeVisible()
  await expect(page.locator('[data-testid="room-overflow-menu"]')).toBeHidden()

  await page.locator('[data-testid="composition-editor"] .cm-content').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText('x'.repeat(400)) // one very long token
  // Not wrapped: the content is wider than the scroller (horizontal scroll exists).
  const overflows = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="composition-editor"] .cm-scroller') as HTMLElement
    return el.scrollWidth > el.clientWidth + 1
  })
  expect(overflows, 'wide viewport keeps long lines unwrapped (scroller overflows)').toBe(true)
})
