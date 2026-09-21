// Offline: sample-map fetches are faked; the Strudel engine is the real one.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { before, describe, test } from 'node:test'
import { BANK_URLS, createTriage, DOUGH, DRUM_MACHINE_ALIASES } from './lib/triage.mjs'

const MAPS = new Map([
  [BANK_URLS[0], { _base: 'x', bd: ['bd.wav'], sd: ['sd.wav'], hh: ['hh.wav'], cp: ['cp.wav'], amencutup: ['a.wav'], breaks125: ['b.wav'] }],
  [BANK_URLS[1], { _base: 'x', RolandTR909_bd: ['x'], RolandTR909_sd: ['x'], AkaiLinn_bd: ['x'] }],
  [BANK_URLS[2], { _base: 'x', piano: ['x'] }],
  [BANK_URLS[3], {}],
  [BANK_URLS[4], {}],
  [BANK_URLS[5], {}],
  [DRUM_MACHINE_ALIASES, { AkaiLinn: 'Linn', RolandTR909: ['tr909', 'nine'] }],
  ['https://raw.githubusercontent.com/yaxu/clean-breaks/main/strudel.json', { _base: 'x', amen: ['a.wav'] }],
])
const fakeFetch = async (url) => {
  const body = MAPS.get(String(url))
  return body ? { ok: true, status: 200, text: async () => JSON.stringify(body) } : { ok: false, status: 404, text: async () => '' }
}

let triage
before(async () => { triage = await createTriage({ fetch: fakeFetch }) })

describe('createTriage', () => {
  test('a pattern that evaluates with known sounds passes', async () => {
    const r = await triage.check('$: s("bd*4, hh*8")')
    assert.equal(r.status, 'pass')
    assert.ok(r.events > 0)
  })

  test('synths and GM soundfonts are known', async () => {
    assert.equal((await triage.check('note("c e g").s("sawtooth")')).status, 'pass')
    assert.equal((await triage.check('note("c e g").s("gm_epiano1")')).status, 'pass')
  })

  test('an unknown sound is reported by name (the silent-amen case)', async () => {
    const r = await triage.check('s("amen").chop(8)')
    assert.equal(r.status, 'missing-sounds')
    assert.deepEqual(r.missing, ['amen'])
  })

  test('samples() loads a pack — for that pattern only', async () => {
    const withPack = await triage.check("samples('github:yaxu/clean-breaks/main')\ns('amen')")
    assert.equal(withPack.status, 'pass')
    const after = await triage.check('s("amen")')
    assert.equal(after.status, 'missing-sounds', 'the pack must not leak into the next pattern')
  })

  test('samples() with an inline map registers its names', async () => {
    assert.equal((await triage.check("samples({ mykick: 'k.wav' })\ns('mykick')")).status, 'pass')
  })

  test('a failing samples() is a note, and the sound stays missing', async () => {
    const r = await triage.check("samples('github:nobody/nothing')\ns('zzz')")
    assert.equal(r.status, 'missing-sounds')
    assert.match(r.notes.join(' '), /failed/)
  })

  test('a drum-machine bank resolves as bank_sound; an unknown bank is reported', async () => {
    assert.equal((await triage.check('s("bd").bank("RolandTR909")')).status, 'pass')
    const r = await triage.check('s("bd").bank("NoSuchMachine")')
    assert.equal(r.status, 'missing-sounds')
    assert.deepEqual(r.missing, ['NoSuchMachine_bd'])
  })

  test('bank aliases work in the right direction (full name → short name), case-insensitively', async () => {
    assert.equal((await triage.check('s("bd").bank("Linn")')).status, 'pass')
    assert.equal((await triage.check('s("bd").bank("tr909")')).status, 'pass')
    assert.equal((await triage.check('s("sd").bank("NINE")')).status, 'pass')
    assert.equal((await triage.check('s("bd").bank("nosuch")')).status, 'missing-sounds')
  })

  test('a typo\'d function is an error, with the message', async () => {
    const r = await triage.check('s("bd*4").fastt(2)')
    assert.equal(r.status, 'error')
    assert.match(r.error, /fastt is not a function/)
  })

  test('a helper defined outside the file surfaces as the same kind of error', async () => {
    const r = await triage.check('s("bd*4").addeg(2)')
    assert.match(r.error, /addeg is not a function/)
  })

  test('the REPL-provided helpers exist (setcps, .p, drawing methods)', async () => {
    const r = await triage.check('setcps(0.5)\n$: s("bd*4").pianoroll()\nstack(s("hh*4")).p("x")')
    assert.equal(r.status, 'pass')
  })

  test('.piano() exists, as strudel.cc\'s REPL defines it (and the sound is the loaded piano bank)', async () => {
    const r = await triage.check('note("c3 e3 g3").piano()')
    assert.equal(r.status, 'pass')
    assert.ok(r.events > 0)
    // and it does not hide a genuinely unknown method
    assert.match((await triage.check('note("c3").pianoo()')).error, /pianoo is not a function/)
  })

  test('a pattern with no events is inconclusive, never a pass', async () => {
    const r = await triage.check('silence')
    assert.equal(r.status, 'inconclusive')
    assert.equal(r.events, 0)
  })

  test('a syntax error is an error', async () => {
    assert.equal((await triage.check('s("bd*4"')).status, 'error')
  })
})

describe('drift guard: the sound banks mirror app/lib/prebake.ts', () => {
  const prebake = readFileSync('app/lib/prebake.ts', 'utf8')
  test('every bank the app loads is in the triage registry', () => {
    assert.ok(prebake.includes("github:tidalcycles/dirt-samples"))
    assert.ok(prebake.includes(`const DOUGH = '${DOUGH}'`))
    for (const u of BANK_URLS.filter(u => u.startsWith(DOUGH))) {
      assert.ok(prebake.includes(`\${DOUGH}/${u.slice(DOUGH.length + 1)}`), `prebake.ts no longer mentions ${u}`)
    }
    assert.ok(prebake.includes(DRUM_MACHINE_ALIASES))
  })
  test('prebake.ts defines .piano() like the REPL (triage mirrors it)', () => {
    assert.match(prebake, /'piano',\s*function/)
    assert.ok(prebake.includes('valueToMidi'))
  })
  test('every DOUGH manifest prebake.ts loads is in the registry', () => {
    const named = [...prebake.matchAll(/\$\{DOUGH\}\/([\w-]+\.json)/g)].map(m => m[1])
    for (const f of named) assert.ok(BANK_URLS.some(u => u.endsWith(`/${f}`)), `prebake.ts loads ${f} but triage does not`)
  })
})
