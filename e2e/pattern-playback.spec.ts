import { expect, test } from '@playwright/test'

// frontend-editor spec — "Every curated library pattern plays": each
// curated pattern must evaluate on the engine without a pattern error.
// Driven through the library's real preview path (same engine + sample
// bank a JAM track uses). Each pattern is summoned with the search box
// so this stays correct as the catalog outgrows one page.
test.use({
  launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
})

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('every curated pattern evaluates without a pattern error', async ({ page }) => {
  test.setTimeout(300_000)

  await page.goto('/app/patterns')

  const patterns: { title: string }[] = await page.evaluate(async () => {
    const res = await fetch('/api/patterns?limit=200')
    const body = await res.json() as { patterns: { title: string }[] }
    return body.patterns
  })
  expect(patterns.length).toBeGreaterThan(0)

  const search = page.getByPlaceholder('Search patterns…')
  const failures: string[] = []

  for (const [i, { title }] of patterns.entries()) {
    await search.fill(title)

    const row = page
      .getByRole('button', { name: new RegExp(`^${escapeRegExp(title)}\\b`) })
      .first()
    await row.click() // expand — the first one lazy-loads engine + samples
    await page.waitForTimeout(i === 0 ? 5000 : 400)

    await page.getByRole('button', { name: /^Preview/ }).click()
    // The eval error, if any, renders within ~1s of the engine being ready.
    await page.waitForTimeout(1500)

    if (await page.getByText('Pattern error').isVisible().catch(() => false)) {
      const msg = await page
        .locator('text=Pattern error')
        .locator('xpath=ancestor::*[1]')
        .innerText()
        .catch(() => '')
      failures.push(`${title} — ${msg.replace(/\s+/g, ' ').trim()}`)
    }

    const stop = page.getByRole('button', { name: /^Stop/ })
    if (await stop.isVisible().catch(() => false)) await stop.click()

    await search.clear()
  }

  expect(failures, `patterns with an eval error:\n${failures.join('\n')}`).toEqual([])
})
