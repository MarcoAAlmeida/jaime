import { writeFileSync } from 'node:fs'
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
//
// Also the playback gate of the `add-patterns` skill (scripts/patterns/
// check.mjs runs this spec). Two environment knobs, both optional:
//   PATTERN_IDS      comma-separated ids — check only those patterns
//   PLAYBACK_REPORT  path — write a JSON report of every pattern checked
// Not run by CI (`npm test` is vitest only) — run it before shipping
// patterns: `npm run test:e2e -- e2e/pattern-playback.spec.ts`.
test.use({
  launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
})

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface CatalogPattern { id: string, title: string }

interface PlaybackResult {
  id: string
  title: string
  status: 'pass' | 'error' | 'missing-sounds'
  error?: string
  missingSounds?: string[]
}

// ~2 s per pattern plus the first-load wait; never below the old flat cap.
function timeoutFor(count: number) {
  return Math.max(300_000, 60_000 + count * 6_000)
}

test('every curated pattern evaluates without a pattern error or a missing sound', async ({ page }) => {
  test.setTimeout(300_000)

  let current = ''
  const missingByTitle = new Map<string, Set<string>>()
  page.on('console', (msg) => {
    const m = msg.text().match(/sound (\S+) not found/)
    if (!m || !current) return
    if (!missingByTitle.has(current)) missingByTitle.set(current, new Set())
    missingByTitle.get(current)!.add(m[1]!)
  })

  await page.goto('/app/patterns')

  // The API caps a page at 60, so walk every page — a single request
  // would silently stop checking anything past the first 60 patterns.
  const all: CatalogPattern[] = await page.evaluate(async () => {
    const out: { id: string, title: string }[] = []
    for (let p = 1; ; p++) {
      const res = await fetch(`/api/patterns?limit=60&page=${p}`)
      const body = await res.json() as { patterns: { id: string, title: string }[], total: number }
      out.push(...body.patterns.map(x => ({ id: x.id, title: x.title })))
      if (body.patterns.length === 0 || out.length >= body.total) break
    }
    return out
  })
  expect(all.length).toBeGreaterThan(0)

  const wanted = (process.env.PATTERN_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const patterns = wanted.length ? all.filter(p => wanted.includes(p.id)) : all
  if (wanted.length) {
    const unknown = wanted.filter(id => !all.some(p => p.id === id))
    expect(unknown, `PATTERN_IDS not found in the library (is the local database synced?): ${unknown.join(', ')}`).toEqual([])
  }
  test.setTimeout(timeoutFor(patterns.length))

  const search = page.getByPlaceholder('Search patterns…')
  const results: PlaybackResult[] = []

  for (const [i, { id, title }] of patterns.entries()) {
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

    let error: string | undefined
    if (await page.getByText('Pattern error').isVisible().catch(() => false)) {
      const msg = await page
        .locator('text=Pattern error')
        .locator('xpath=ancestor::*[1]')
        .innerText()
        .catch(() => '')
      error = msg.replace(/\s+/g, ' ').trim()
    }

    const stop = page.getByRole('button', { name: /^Stop/ })
    if (await stop.isVisible().catch(() => false)) await stop.click()

    const missing = [...(missingByTitle.get(title) ?? [])]
    current = ''
    results.push({
      id,
      title,
      status: error ? 'error' : missing.length ? 'missing-sounds' : 'pass',
      ...(error ? { error } : {}),
      ...(missing.length ? { missingSounds: missing } : {}),
    })

    await search.clear()
  }

  if (process.env.PLAYBACK_REPORT) {
    writeFileSync(process.env.PLAYBACK_REPORT, `${JSON.stringify({ results }, null, 2)}\n`)
  }

  const failures = results.filter(r => r.status === 'error').map(r => `${r.title} — ${r.error}`)
  const silent = results.filter(r => r.missingSounds).map(r => `${r.title} — ${r.missingSounds!.map(s => `sound "${s}" not found`).join(', ')}`)
  expect(failures, `patterns with an eval error:\n${failures.join('\n')}`).toEqual([])
  expect(
    silent,
    `patterns that ask for a sound that isn't loaded (they play silence):\n${silent.join('\n')}`,
  ).toEqual([])
})
