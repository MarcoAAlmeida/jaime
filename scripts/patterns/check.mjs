#!/usr/bin/env node
// Playback check — the gate of the add-patterns skill ("nothing is added
// unless it plays", add-pattern-ingestion-skill, design decision 7).
//
//   node scripts/patterns/check.mjs <id> [<id>…]           patterns already in the library
//   node scripts/patterns/check.mjs --candidates <file|->  candidates (JSON: [{ code, label? }])
//   add --fast   Node-only triage instead of the browser (ms per pattern)
//
// Browser tier (the real gate): candidates are put into the LOCAL database
// as temporary `origin='user'` rows (reconcile never touches those), the
// playback spec (e2e/pattern-playback.spec.ts) checks them through the
// library's real preview path in headless Chromium, and the rows are removed
// again — even if the run fails. Nothing touches a remote system. If no
// local server is running Playwright builds and starts one (slow the first
// time); a running `wrangler dev` on :8788 is reused.
//
// stdout: { tier, results: [{ label, status, error?, missingSounds?, depends?, message? }] }
// status: pass | error | missing-sounds | dependency | inconclusive (fast only)
// exit:   0 all pass · 1 anything else · 2 the check itself could not run

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sq } from '../lib/patterns-manifest.mjs'

// The name is the last identifier before "is not …": Strudel reports
// `s(...).addeg is not a function`, JS reports `mySynth is not defined`.
const DEP = /([A-Za-z_$][\w$]*) is not (?:a function|defined)/

/**
 * A failure that reads like "something outside this file is missing" is
 * reported as a dependency — the skill then asks the developer (report and
 * ask). It may equally be a typo; the message says so.
 */
export function classify(result) {
  if (result.status === 'error' && result.error) {
    const m = DEP.exec(result.error)
    if (m) {
      return {
        ...result,
        status: 'dependency',
        depends: [m[1]],
        message: `uses '${m[1]}', which is not defined in this file — a helper defined elsewhere, or a typo`,
      }
    }
  }
  return result
}

const TEMP_PREFIX = '__check__'

/** Temporary local rows for candidates: `INSERT` and `DELETE` statements. */
export function tempRowsSql(rows) {
  const ids = rows.map(r => sq(r.id)).join(', ')
  const insert = rows.map(r =>
    `INSERT INTO patterns (id, title, code, source_url, source_author, created_at, origin, favorite) VALUES (${sq(r.id)}, ${sq(r.id)}, ${sq(r.code)}, 'https://example.invalid/check', NULL, '2000-01-01T00:00:00.000Z', 'user', 0);`)
  return {
    insert: `${insert.join('\n')}\n`,
    remove: `DELETE FROM pattern_tags WHERE pattern_id IN (${ids});\nDELETE FROM patterns WHERE id IN (${ids});\n`,
  }
}

function execLocalSql(sql) {
  const file = join(mkdtempSync(join(tmpdir(), 'jaime-check-')), 'check.sql')
  writeFileSync(file, sql)
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'PATTERNS_DB', '--local', '--file', file], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, CI: '1' },
  })
  if (r.status !== 0) throw new Error(`local database write failed: ${(r.stderr || r.stdout || '').trim().slice(-300)}`)
}

function runPlaywright(ids) {
  const report = join(mkdtempSync(join(tmpdir(), 'jaime-check-')), 'report.json')
  const r = spawnSync('npx', ['playwright', 'test', 'e2e/pattern-playback.spec.ts', '--reporter=line'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, PATTERN_IDS: ids.join(','), PLAYBACK_REPORT: report },
  })
  if (!existsSync(report)) throw new Error(`the playback run produced no report (exit ${r.status}): ${`${r.stdout}${r.stderr}`.trim().slice(-400)}`)
  return JSON.parse(readFileSync(report, 'utf8'))
}

/**
 * @param {{ label: string, id?: string, code?: string }[]} items an `id` checks a library pattern; `code` a candidate
 * @param {{ tier?: 'browser'|'fast', deps?: object }} [options]
 */
export async function runCheck(items, options = {}) {
  const tier = options.tier ?? 'browser'
  const deps = { execSql: execLocalSql, playwright: runPlaywright, ...options.deps }

  if (tier === 'fast') {
    const triage = await (deps.createTriage ?? (async () => (await import('./lib/triage.mjs')).createTriage()))()
    const results = []
    for (const item of items) {
      let code = item.code
      if (code == null) {
        const { readManifest } = await import('../lib/patterns-manifest.mjs')
        code = readManifest().find(e => e.id === item.id)?.code
      }
      if (code == null) {
        results.push({ label: item.label, status: 'error', error: `no pattern with id '${item.id}'` })
        continue
      }
      const r = await triage.check(code)
      results.push(classify({ label: item.label, status: r.status, ...(r.error ? { error: r.error } : {}), ...(r.missing ? { missingSounds: r.missing } : {}), ...(r.notes?.length ? { notes: r.notes } : {}) }))
    }
    return { tier, results }
  }

  const runId = Date.now().toString(36)
  const staged = items.map((it, n) => ({ ...it, checkId: it.id ?? `${TEMP_PREFIX}${runId}_${n}`, temp: it.id == null }))
  const temps = staged.filter(s => s.temp).map(s => ({ id: s.checkId, code: s.code }))
  const sql = temps.length ? tempRowsSql(temps) : null

  let report
  try {
    if (sql) deps.execSql(sql.insert)
    report = deps.playwright(staged.map(s => s.checkId))
  }
  finally {
    if (sql) {
      try {
        deps.execSql(sql.remove)
      }
      catch (err) {
        console.error(`warning: could not remove temporary check rows (${TEMP_PREFIX}${runId}_*): ${err.message}`)
      }
    }
  }

  const byId = new Map(report.results.map(r => [r.id, r]))
  const results = staged.map((s) => {
    const r = byId.get(s.checkId)
    if (!r) return { label: s.label, status: 'error', error: 'the playback run did not report this pattern' }
    return classify({
      label: s.label,
      status: r.status,
      ...(r.error ? { error: r.error } : {}),
      ...(r.missingSounds ? { missingSounds: r.missingSounds } : {}),
    })
  })
  return { tier, results }
}

async function main(argv) {
  // Strudel prints banners ("@strudel/core loaded") with console.log. stdout
  // is this script's JSON channel, so library chatter goes to stderr.
  console.log = (...args) => console.error(...args)
  const fast = argv.includes('--fast')
  const candFlag = argv.indexOf('--candidates')
  const ids = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--candidates')
  const items = ids.map(id => ({ label: id, id }))
  if (candFlag !== -1) {
    const src = argv[candFlag + 1]
    const list = JSON.parse(src === '-' ? readFileSync(0, 'utf8') : readFileSync(src, 'utf8'))
    for (const [n, c] of (Array.isArray(list) ? list : [list]).entries()) items.push({ label: c.label ?? c.path ?? c.hints?.title ?? `candidate ${n + 1}`, code: c.code })
  }
  if (items.length === 0) {
    console.error('usage: check.mjs <id…> | --candidates <file|-> [--fast]')
    process.exit(64)
  }
  let out
  try {
    out = await runCheck(items, { tier: fast ? 'fast' : 'browser' })
  }
  catch (err) {
    console.error(`✖ ${err.message}`)
    process.exit(2)
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
  process.exit(out.results.every(r => r.status === 'pass') ? 0 : 1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main(process.argv.slice(2))
