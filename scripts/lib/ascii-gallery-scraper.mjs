// asciiart.eu crawler — discovers every subcategory under the site's
// top-level categories and parses each subcategory page's art cards
// into rows for the `ascii_art` table. Plain ESM; imported by
// scripts/scrape-ascii-gallery.mjs (the CLI) and its test file.
//
// Site structure (verified by direct crawling — see
// openspec/changes/add-ascii-overlay/design.md): 26 category pages are
// pure indexes (no art), each linking to several leaf subcategory
// pages. Every subcategory page renders all of its pieces inline, no
// pagination, as `<div class="card art-card" data-id data-title
// data-artist data-width data-height ...>` wrapping a
// `.art-card__ascii` div holding the raw text. Individual `/art/<id>`
// permalink pages are a client-side route only — never fetched here.

export const BASE_URL = 'https://www.asciiart.eu'

// The 26 real top-level category slugs, confirmed live (each returned
// >0 subcategories, no 404s) during proposal research.
export const CATEGORIES = [
  'animals',
  'buildings-and-places',
  'cartoons',
  'clothing-and-accessories',
  'comics',
  'computers',
  'electronics',
  'food-and-drinks',
  'holiday-and-events',
  'logos',
  'miscellaneous',
  'movies',
  'music',
  'mythology',
  'nature',
  'people',
  'plants',
  'religion',
  'space',
  'sports-and-outdoors',
  'television',
  'toys',
  'vehicles',
  'video-games',
  'weapons',
  'books',
]

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '\'',
  nbsp: ' ',
}

/** Decodes the small set of HTML entities the site actually emits in
 *  art text/attributes (named + numeric). Never full HTML parsing —
 *  the source pages have no nested markup inside the pieces this reads. */
export function decodeHtmlEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, body) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    const key = body.toLowerCase()
    return key in NAMED_ENTITIES ? NAMED_ENTITIES[key] : m
  })
}

/** Unique `/{category}/{slug}` subcategory slugs linked from a category
 *  index page's HTML. */
export function extractSubcategorySlugs(html, category) {
  const re = new RegExp(`href="/${category}/([a-z0-9-]+)"`, 'g')
  const found = new Set()
  let m
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(html)) !== null) found.add(m[1])
  return [...found]
}

function attr(tag, name) {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag)
  return m ? decodeHtmlEntities(m[1]) : ''
}

/** Every art piece on a subcategory page's HTML, as rows shaped for
 *  the `ascii_art` table (minus `source_url`/`scraped_at`, added by
 *  the caller once the id is known). */
export function extractArtPieces(html, category, subcategory) {
  const cardOpenRe = /<div class="card art-card[^"]*"[^>]*>/g
  const starts = []
  let m
  // eslint-disable-next-line no-cond-assign
  while ((m = cardOpenRe.exec(html)) !== null) starts.push({ index: m.index, tag: m[0] })

  const pieces = []
  for (let i = 0; i < starts.length; i++) {
    const chunkEnd = i + 1 < starts.length ? starts[i + 1].index : html.length
    const chunk = html.slice(starts[i].index, chunkEnd)
    const id = attr(starts[i].tag, 'data-id')
    if (!id) continue

    const asciiMatch = /<div class="art-card__ascii">([\s\S]*?)<\/div>/.exec(chunk)
    if (!asciiMatch) continue

    const width = Number.parseInt(attr(starts[i].tag, 'data-width'), 10)
    const height = Number.parseInt(attr(starts[i].tag, 'data-height'), 10)
    const title = attr(starts[i].tag, 'data-title')
    const artist = attr(starts[i].tag, 'data-artist')

    pieces.push({
      id,
      title: title || null,
      artist: (artist && artist !== 'unknown') ? artist : null,
      category,
      subcategory,
      width: Number.isFinite(width) ? width : 0,
      height: Number.isFinite(height) ? height : 0,
      // The site's line breaks are literal \r\n, plus a stray trailing
      // \r with no paired \n right before the closing </div> — drop
      // any remaining bare \r after normalizing real line breaks.
      text: decodeHtmlEntities(asciiMatch[1]).replace(/\r\n/g, '\n').replace(/\r/g, ''),
    })
  }
  return pieces
}

/** Throws when a subcategory page clearly has art cards in its raw
 *  HTML but the parser extracted none — a markup-change regression,
 *  never silently swallowed (design.md risk: fail loudly). */
export function assertParsedSubcategory({ html, pieces, category, subcategory }) {
  // The literal card markup class, not the bare word — every page's
  // inline JS references `.art-card` (a CSS selector) regardless of
  // whether the subcategory actually has any cards, so that substring
  // alone can't tell "genuinely empty" from "parser broke" apart.
  const looksLikeItHasCards = html.includes('class="card art-card')
  if (looksLikeItHasCards && pieces.length === 0) {
    throw new Error(
      `${category}/${subcategory}: page HTML contains 'art-card' but 0 pieces were parsed — `
      + `asciiart.eu's markup likely changed; fix the parser before re-running`,
    )
  }
}

function sq(value) {
  if (value == null) return 'NULL'
  return `'${String(value).replace(/'/g, '\'\'')}'`
}

/** Batched `INSERT ... ON CONFLICT` SQL for a slice of scraped rows.
 *  Idempotent — safe to re-run the same rows. */
export function buildInsertSql(rows, scrapedAt) {
  const lines = ['-- generated by scripts/lib/ascii-gallery-scraper.mjs — do not edit by hand']
  for (const r of rows) {
    const sourceUrl = `${BASE_URL}/art/${r.id}`
    lines.push(
      `INSERT INTO ascii_art (id, title, artist, category, subcategory, width, height, text, source_url, scraped_at) VALUES (`
      + `${sq(r.id)}, ${sq(r.title)}, ${sq(r.artist)}, ${sq(r.category)}, ${sq(r.subcategory)}, `
      + `${r.width}, ${r.height}, ${sq(r.text)}, ${sq(sourceUrl)}, ${sq(scrapedAt)})`
      + ` ON CONFLICT(id) DO UPDATE SET title=excluded.title, artist=excluded.artist, `
      + `category=excluded.category, subcategory=excluded.subcategory, width=excluded.width, `
      + `height=excluded.height, text=excluded.text, source_url=excluded.source_url, scraped_at=excluded.scraped_at;`,
    )
  }
  return `${lines.join('\n')}\n`
}
