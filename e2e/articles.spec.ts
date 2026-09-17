import { expect, test } from '@playwright/test'

// add-articles — Explanation-type content, flat (no nav tree),
// reachable from both the home page and the /articles index, reusing
// docs-shell's auth-gate contract. The webServer runs with AUTH_E2E=1
// so /api/auth/request returns the magic link in `devLink`.
test.describe.configure({ retries: 2 })

async function signIn(page: import('@playwright/test').Page, email: string, name?: string) {
  await page.goto('/signup')
  await page.locator('[data-testid="signin-email"]').fill(email)
  if (name) await page.locator('[data-testid="signin-name"]').fill(name)
  const [res] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/auth/request')),
    page.locator('[data-testid="signin-submit"]').click(),
  ])
  const { devLink } = await res.json() as { devLink: string }
  expect(devLink).toContain('/auth/callback?token=')
  await page.goto(devLink)
}

// UPageCard renders its clickable `:to` link as its own element (the
// one carrying our data-testid) separate from the visible card body —
// the link itself is a zero-size click-through overlay with no text
// content, so it never reports as "visible" and can't be found by
// text. Its accessible name (aria-label, from the card's `title`) is
// reliable though. For the actual visible card box (title, image,
// badges), scope by the nearest `[data-slot="root"]` ancestor that
// contains that link.
function articleLink(page: import('@playwright/test').Page, title: string) {
  return page.getByRole('link', { name: title, exact: true })
}
function articleCard(page: import('@playwright/test').Page, title: string) {
  // Ancestor sections also carry data-slot="root" and structurally
  // "have" the link as a descendant — the card's own root is always
  // the innermost (last in document order) match.
  return page.locator('[data-slot="root"]').filter({ has: articleLink(page, title) }).last()
}

test('the home page and the articles index both list articles, linking to the same pages', async ({ page }) => {
  await page.goto('/')
  await expect(articleCard(page, 'Test article')).toBeVisible()
  const href = await articleLink(page, 'Test article').getAttribute('href')

  await page.goto('/articles')
  await expect(articleLink(page, 'Test article')).toHaveAttribute('href', href!)
})

test('a locked article is listed everywhere but gated for an anonymous visitor', async ({ page }) => {
  await page.goto('/articles')
  const lockedCard = articleCard(page, 'Test locked article')
  await expect(lockedCard).toBeVisible()
  await expect(lockedCard).toContainText('Sign in to read')

  const href = await articleLink(page, 'Test locked article').getAttribute('href')
  await page.goto(href!)

  await expect(page.getByTestId('article-locked')).toBeVisible()
  expect(await page.content()).not.toContain('If you can read this')
})

test('a signed-in visitor reads a locked article normally', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await signIn(page, `article-reader-${Date.now()}@example.com`, 'Reader')
  await page.goto('/articles')
  const href = await articleLink(page, 'Test locked article').getAttribute('href')
  await page.goto(href!)

  await expect(page.getByTestId('article-locked')).toHaveCount(0)
  expect(await page.content()).toContain('If you can read this')

  await ctx.close()
})
