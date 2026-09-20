import { expect, test } from '@playwright/test'

// frontend-editor spec — "Every curated library pattern plays": each
// curated pattern must evaluate on the engine without a pattern error,
// AND every sound it asks for must exist. A missing sound is NOT an eval
// error — the engine just logs `sound X not found! Is it loaded?` for each
// event and plays silence — which is how three `s("amen")` patterns sat in
// the library making no sound. (Dirt-Samples has `amencutup`, not `amen`;
// `amen` lives in yaxu/clean-breaks, which those patterns must load.)
// Driven through the library's real preview path (same engine + sample
// bank a JAM track uses). Each pattern is summoned with the search box
// so this stays correct as the catalog outgrows one page.
test.use({
  launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
})

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('every curated pattern evaluates without a pattern error or a missing sound', async ({ page }) => {
  test.setTimeout(300_000)

  let current = ''
  const missingSounds = new Set<string>()
  page.on('console', (msg) => {
    const m = msg.text().match(/sound (\S+) not found/)
    if (m && current) missingSounds.add(`${current} — sound "${m[1]}" not found`)
  })

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

    // The row's accessible name is "<title> <tag1> <tag2> …" — match the
    // title followed by whitespace or end-of-string, not `\b`: a title
    // ending in punctuation (e.g. "Birds of a Feather (remake)") has no
    // word-boundary before the following space, since neither side is a
    // word character.
    const row = page
      .getByRole('button', { name: new RegExp(`^${escapeRegExp(title)}(?:\\s|$)`) })
      .first()
    await row.click() // expand — the first one lazy-loads engine + samples
    await page.waitForTimeout(i === 0 ? 5000 : 400)

    current = title
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
    current = ''

    await search.clear()
  }

  expect(failures, `patterns with an eval error:\n${failures.join('\n')}`).toEqual([])
  expect(
    [...missingSounds],
    `patterns that ask for a sound that isn't loaded (they play silence):\n${[...missingSounds].join('\n')}`,
  ).toEqual([])
})
