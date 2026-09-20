// Offline tests: every network call goes through a fake fetch.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { decodeStrudelFragment, notStrudelReason, parseHeader, resolveSource } from './lib/resolvers.mjs'

/** A fake fetch over a route table: exact URL (or RegExp) → body / { status, body, headers }. */
function fakeFetch(routes) {
  const calls = []
  const fn = async (url) => {
    calls.push(String(url))
    for (const [key, value] of routes) {
      if (typeof key === 'string' ? key === String(url) : key.test(String(url))) {
        const r = typeof value === 'object' && value !== null && 'body' in value ? value : { body: value }
        const status = r.status ?? 200
        const headers = Object.fromEntries(Object.entries(r.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]))
        const text = typeof r.body === 'string' ? r.body : JSON.stringify(r.body)
        return { ok: status >= 200 && status < 300, status, text: async () => text, headers: { get: k => headers[k.toLowerCase()] ?? null } }
      }
    }
    return { ok: false, status: 404, text: async () => 'not found', headers: { get: () => null } }
  }
  fn.calls = calls
  return fn
}

const b64 = code => Buffer.from(code, 'utf8').toString('base64')
const LIB = [{ id: 'known', sourceUrl: 'https://strudel.cc/#known' }]
const deps = (routes = [], extra = {}) => ({ fetch: fakeFetch(routes), library: LIB, ...extra })

describe('parseHeader', () => {
  test('reads @title / @by / @license, dropping a URL after the author', () => {
    const h = parseHeader('/*\n@title BIRDS (REMAKE)\n@by saga_3k <https://linktr.ee/x>\n@license CC BY-NC-SA\n*/\ns("bd")')
    assert.deepEqual(h, { title: 'BIRDS (REMAKE)', author: 'saga_3k', license: 'CC BY-NC-SA' })
  })
  test('reads a quoted first-line title and a "script @by" line', () => {
    assert.deepEqual(parseHeader('// "The Cardiacs Cadence"\n// script @by eefano\ns("bd")'), { title: 'The Cardiacs Cadence', author: 'eefano' })
  })
  test('a title with a suffix still yields the quoted part', () => {
    assert.equal(parseHeader('// "Up In Annie\'s Room" (work in progress)\ns("bd")').title, "Up In Annie's Room")
  })
  test('no header, no hints', () => {
    assert.deepEqual(parseHeader('s("bd*4")'), {})
  })
})

describe('notStrudelReason', () => {
  test('declines Tidal, Sonic Pi, SuperCollider, empty; accepts Strudel', () => {
    assert.match(notStrudelReason('d1 $ sound "bd*4"'), /Tidal/)
    assert.match(notStrudelReason('live_loop :a do\n play 60\nend'), /Sonic Pi/)
    assert.match(notStrudelReason('SynthDef(\\a, {})'), /SuperCollider/)
    assert.match(notStrudelReason('   '), /empty/)
    assert.equal(notStrudelReason('$: s("bd*4").fast(2)'), null)
  })
})

describe('strudel.cc #base64 links (offline)', () => {
  test('decodes the fragment, including UTF-8 and url-encoded padding', async () => {
    const code = '// "Título"\n$: s("bd*4") // ♪'
    const link = `https://strudel.cc/#${encodeURIComponent(b64(code))}`
    const r = await resolveSource(link, deps())
    assert.equal(r.ok, true)
    assert.equal(r.candidates[0].code, code)
    assert.equal(r.candidates[0].sourceUrl, link)
    assert.equal(r.candidates[0].hints.title, 'Título')
  })
  test('makes no network request', async () => {
    const d = deps()
    await resolveSource(`https://strudel.cc/#${b64('s("bd")')}`, d)
    assert.deepEqual(d.fetch.calls, [])
  })
  test('a fragment that is not base64 is reported, not guessed', async () => {
    const r = await resolveSource('https://strudel.cc/#not*base64!', deps())
    assert.deepEqual([r.ok, r.reason], [false, 'not-base64'])
  })
  test('flags a link whose source is already in the library', async () => {
    const link = `https://strudel.cc/#${b64('s("bd")')}`
    const r = await resolveSource(link, deps([], { library: [{ id: 'have-it', sourceUrl: link }] }))
    assert.equal(r.candidates[0].existing, 'have-it')
    assert.match(r.candidates[0].notes.join(' '), /already in the library as 'have-it'/)
  })
  test('a strudel.cc page (no fragment, no short id) needs a reader', async () => {
    const r = await resolveSource('https://strudel.cc/learn/samples/', deps())
    assert.deepEqual([r.ok, r.reason], [false, 'needs-reader'])
  })
})

describe('strudel.cc ?short links', () => {
  // The real page has no <script src> for the REPL: it is named by an astro-island.
  const html = '<html><astro-island component-url="/_astro/Repl.aaa.js" client="only"></astro-island></html>'
  const repl = 'import{x}from"./prebake.bbb.js";export{x}'
  const prebake = 'const u="https://proj123.supabase.co";const k="eyJhbGciOi.eyJyb2xlIjoi.c2lnbmF0dXJl";'
  const site = (rows = [{ code: '/*\n@title Short one\n@by someone\n*/\ns("bd*4")' }]) => [
    ['https://strudel.cc/', html],
    ['https://strudel.cc/_astro/Repl.aaa.js', repl],
    ['https://strudel.cc/_astro/prebake.bbb.js', prebake],
    [/proj123\.supabase\.co\/rest\/v1\/code_v1\?select=code&hash=eq\.abcDEF123$/, rows],
  ]

  test('finds the store in the site scripts and returns the stored code, keeping the short link as source', async () => {
    const link = 'https://strudel.cc/?abcDEF123'
    const r = await resolveSource(link, deps(site()))
    assert.equal(r.ok, true)
    assert.equal(r.candidates[0].sourceUrl, link)
    assert.deepEqual(r.candidates[0].hints, { title: 'Short one', author: 'someone' })
  })
  test('the client key is read from the site at run time (sent as apikey)', async () => {
    const seen = []
    const d = deps(site())
    const inner = d.fetch
    d.fetch = async (url, init) => { seen.push(init?.headers); return inner(url, init) }
    await resolveSource('https://strudel.cc/?abcDEF123', d)
    assert.ok(seen.some(h => h?.apikey === 'eyJhbGciOi.eyJyb2xlIjoi.c2lnbmF0dXJl'))
  })
  test('an unknown hash is not-found', async () => {
    const r = await resolveSource('https://strudel.cc/?abcDEF123', deps(site([])))
    assert.deepEqual([r.ok, r.reason], [false, 'not-found'])
  })
  test('a site whose scripts no longer mention a store degrades to a clear message', async () => {
    const r = await resolveSource('https://strudel.cc/?abcDEF123', deps([['https://strudel.cc/', html], ['https://strudel.cc/_astro/Repl.aaa.js', 'nothing here']]))
    assert.equal(r.reason, 'short-link-unavailable')
    assert.match(r.message, /pasted/)
  })
  test('the site being down degrades the same way, never a crash', async () => {
    const d = deps()
    d.fetch = async () => { throw new Error('ECONNRESET') }
    const r = await resolveSource('https://strudel.cc/?abcDEF123', d)
    assert.equal(r.reason, 'short-link-unavailable')
  })
})

describe('raw, blob, gist, pages', () => {
  test('a raw URL is fetched and is its own source', async () => {
    const url = 'https://raw.githubusercontent.com/o/r/main/song.js'
    const r = await resolveSource(url, deps([[url, '// "Song"\ns("bd")']]))
    assert.equal(r.candidates[0].sourceUrl, url)
    assert.equal(r.candidates[0].hints.title, 'Song')
  })
  test('a GitHub blob URL is read via raw and keeps the blob URL as source', async () => {
    const blob = 'https://github.com/o/r/blob/main/dir/a%20b.js'
    const r = await resolveSource(blob, deps([['https://raw.githubusercontent.com/o/r/main/dir/a%20b.js', 's("bd")']]))
    assert.equal(r.candidates[0].sourceUrl, blob)
    assert.equal(r.candidates[0].path, 'dir/a b.js')
  })
  test('a gist yields its code files', async () => {
    const r = await resolveSource('https://gist.github.com/ann/abc123', deps([[
      'https://api.github.com/gists/abc123',
      { owner: { login: 'ann' }, files: { 'a.js': { filename: 'a.js', content: 's("bd")' }, 'README.md': { filename: 'README.md', content: '# hi' } } },
    ]]))
    assert.equal(r.candidates.length, 1)
    assert.equal(r.candidates[0].sourceUrl, 'https://gist.github.com/ann/abc123')
  })
  test('an HTML page needs a reader instead of being scraped', async () => {
    const url = 'https://example.com/post'
    const r = await resolveSource(url, deps([[url, { body: '<html><body>hello</body></html>', headers: { 'content-type': 'text/html' } }]]))
    assert.deepEqual([r.ok, r.reason], [false, 'needs-reader'])
  })
  test('other live-coding code is declined with a reason', async () => {
    const url = 'https://example.com/a.tidal'
    const r = await resolveSource(url, deps([[url, 'd1 $ sound "bd*4"']]))
    assert.deepEqual([r.ok, r.reason], [false, 'not-strudel'])
  })
  test('a 404 is not-found; a 500 is http', async () => {
    assert.equal((await resolveSource('https://example.com/missing.js', deps())).reason, 'not-found')
    assert.equal((await resolveSource('https://example.com/x.js', deps([['https://example.com/x.js', { status: 500, body: 'no' }]]))).reason, 'http')
  })
})

describe('local files and stdin', () => {
  test('a local file needs a source URL to be complete, and says so', async () => {
    const r = await resolveSource('song.js', { library: LIB, exists: () => true, readFile: () => 's("bd")' })
    assert.equal(r.candidates[0].sourceUrl, null)
    assert.match(r.candidates[0].notes.join(' '), /no source URL/)
  })
  test('a source URL supplied with the file is used', async () => {
    const r = await resolveSource('song.js', { library: LIB, exists: () => true, readFile: () => 's("bd")', sourceUrl: 'https://example.com/s' })
    assert.equal(r.candidates[0].sourceUrl, 'https://example.com/s')
    assert.deepEqual(r.candidates[0].notes, [])
  })
  test('stdin is read for "-"', async () => {
    const r = await resolveSource('-', { library: LIB, stdin: () => '$: s("bd")', sourceUrl: 'https://example.com/p' })
    assert.equal(r.candidates[0].code, '$: s("bd")')
  })
  test('something that is neither a URL nor a file is unsupported', async () => {
    const r = await resolveSource('nonsense', { library: LIB, exists: () => false })
    assert.equal(r.reason, 'unsupported')
  })
})

describe('GitHub repository or directory', () => {
  const tree = {
    tree: [
      { type: 'blob', path: 'README.md', size: 10 },
      { type: 'blob', path: 'a.js', size: 20 },
      { type: 'blob', path: 'sub/b.js', size: 20 },
      { type: 'blob', path: 'functions/help.js', size: 20 },
      { type: 'blob', path: 'tidal.js', size: 20 },
      { type: 'blob', path: 'huge.js', size: 999999 },
      { type: 'blob', path: '.vscode/settings.js', size: 5 },
      { type: 'blob', path: 'node_modules/x/y.js', size: 5 },
      { type: 'blob', path: 'gone.js', size: 5 },
    ],
  }
  const routes = () => [
    ['https://api.github.com/repos/o/r', { default_branch: 'trunk' }],
    ['https://api.github.com/repos/o/r/git/trees/trunk?recursive=1', tree],
    ['https://raw.githubusercontent.com/o/r/trunk/a.js', '// "A song"\n// script @by ann\ns("bd")'],
    ['https://raw.githubusercontent.com/o/r/trunk/sub/b.js', 'const f = register("f", (p) => p)\n$: s("sd").f()'],
    ['https://raw.githubusercontent.com/o/r/trunk/functions/help.js', 'const h = register("h", (p) => p)'],
    ['https://raw.githubusercontent.com/o/r/trunk/tidal.js', 'd1 $ sound "bd*4"'],
  ]

  test('lists code files on the default branch with branch-URL sources, sorted', async () => {
    const r = await resolveSource('https://github.com/o/r', deps(routes(), { library: [] }))
    assert.equal(r.ok, true)
    assert.deepEqual(r.candidates.map(c => c.path), ['a.js', 'functions/help.js', 'sub/b.js'])
    assert.equal(r.candidates[0].sourceUrl, 'https://github.com/o/r/blob/trunk/a.js')
    assert.deepEqual(r.candidates[0].hints, { title: 'A song', author: 'ann' })
  })
  test('flags helpers and register() users; skips non-Strudel, oversized, unreadable, dotdirs, node_modules, non-code', async () => {
    const r = await resolveSource('https://github.com/o/r', deps(routes(), { library: [] }))
    const by = Object.fromEntries(r.candidates.map(c => [c.path, c]))
    assert.equal(by['functions/help.js'].helper, true)
    assert.match(by['sub/b.js'].notes.join(' '), /register\(\)/)
    assert.equal(by['sub/b.js'].helper, undefined)
    const why = Object.fromEntries(r.skipped.map(s => [s.path, s.reason]))
    assert.match(why['tidal.js'], /Tidal/)
    assert.match(why['huge.js'], /larger than/)
    assert.ok(why['gone.js'])
    assert.equal(why['README.md'], undefined)
    assert.equal(why['.vscode/settings.js'], undefined)
    assert.equal(why['node_modules/x/y.js'], undefined)
  })
  test('uses one tree listing and raw fetches — no per-file API calls', async () => {
    const d = deps(routes(), { library: [] })
    await resolveSource('https://github.com/o/r', d)
    assert.equal(d.fetch.calls.filter(u => u.startsWith('https://api.github.com')).length, 2)
  })
  test('a /tree/<branch>/<dir> URL restricts to that directory and skips the repo lookup', async () => {
    const d = deps(routes(), { library: [] })
    const r = await resolveSource('https://github.com/o/r/tree/trunk/sub', d)
    assert.deepEqual(r.candidates.map(c => c.path), ['sub/b.js'])
    assert.ok(!d.fetch.calls.includes('https://api.github.com/repos/o/r'))
  })
  test('marks files whose source is already in the library', async () => {
    const r = await resolveSource('https://github.com/o/r', deps(routes(), { library: [{ id: 'a-song', sourceUrl: 'https://github.com/o/r/blob/trunk/a.js' }] }))
    assert.equal(r.candidates.find(c => c.path === 'a.js').existing, 'a-song')
  })
  test('a repository with no code files is not-found', async () => {
    const r = await resolveSource('https://github.com/o/r', deps([['https://api.github.com/repos/o/r', { default_branch: 'main' }], ['https://api.github.com/repos/o/r/git/trees/main?recursive=1', { tree: [{ type: 'blob', path: 'README.md', size: 1 }] }]]))
    assert.deepEqual([r.ok, r.reason], [false, 'not-found'])
  })
  test('the candidate cap is applied and reported', async () => {
    const r = await resolveSource('https://github.com/o/r', deps(routes(), { library: [], maxCandidates: 1 }))
    assert.equal(r.candidates.length + r.skipped.length <= 3, true)
    assert.match(r.notes.join(' '), /only the first 1 of/)
  })
})

describe('decodeStrudelFragment', () => {
  test('round-trips arbitrary text', () => {
    const code = 'note("c e g").s("gm_piano")\n// ünïcode ✓'
    assert.equal(decodeStrudelFragment(b64(code)), code)
  })
})
