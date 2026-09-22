import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fingerprintCaseSet, loadCaseSet, renderMessage, validateCaseSet } from './cases.mjs'

const docs = { id: 'a-question', kind: 'docs', message: 'what does .fast do?', expect: ['fast'] }
const fix = { id: 'a-fix', kind: 'fix', broken: 's("bd").lpd(1)', error: 'lpd is not a function' }
const compose = { id: 'a-piece', kind: 'compose', message: 'a beat', mustUse: ['bd'], minEvents: 4 }

test('a well-formed set of all three kinds has no problems', () => {
  assert.deepEqual(validateCaseSet([docs, fix, compose]), [])
})

test('the real committed case set is well-formed', () => {
  const { problems } = loadCaseSet()
  assert.deepEqual(problems, [])
})

test('two cases sharing an id are reported as a duplicate', () => {
  const problems = validateCaseSet([docs, { ...compose, id: docs.id }])
  assert.ok(problems.some(p => p.includes('duplicate id') && p.includes(docs.id)))
})

test('an unknown kind is reported', () => {
  const problems = validateCaseSet([{ id: 'x', kind: 'riddle', message: 'huh' }])
  assert.ok(problems.some(p => p.includes('unknown kind')))
})

test('a docs case needs a non-empty "expect"', () => {
  assert.ok(validateCaseSet([{ ...docs, expect: undefined }]).some(p => p.includes('expect')))
  assert.ok(validateCaseSet([{ ...docs, expect: [] }]).some(p => p.includes('expect')))
})

test('a fix case needs "broken" and "error"', () => {
  assert.ok(validateCaseSet([{ ...fix, broken: undefined }]).some(p => p.includes('broken')))
  assert.ok(validateCaseSet([{ ...fix, error: undefined }]).some(p => p.includes('error')))
})

test('a fix case may omit "message" — nothing else may', () => {
  assert.deepEqual(validateCaseSet([{ ...fix, message: undefined }]), [])
  assert.ok(validateCaseSet([{ ...docs, message: undefined }]).some(p => p.includes('message')))
  assert.ok(validateCaseSet([{ ...compose, message: undefined }]).some(p => p.includes('message')))
})

test('a non-kebab-case id is reported', () => {
  assert.ok(validateCaseSet([{ ...docs, id: 'Not Kebab' }]).some(p => p.includes('kebab')))
})

test('every problem is reported, not just the first', () => {
  const problems = validateCaseSet([{ id: 'Bad Id', kind: 'docs', expect: [] }])
  assert.ok(problems.length >= 2)
})

test('fingerprint changes when a case changes, and ignores case order', () => {
  const f1 = fingerprintCaseSet([docs, fix])
  const f2 = fingerprintCaseSet([fix, docs])
  const f3 = fingerprintCaseSet([{ ...docs, expect: ['fast', 'slow'] }, fix])
  assert.equal(f1, f2)
  assert.notEqual(f1, f3)
})

test('renderMessage() passes docs/compose messages through unchanged', () => {
  assert.equal(renderMessage(docs), docs.message)
  assert.equal(renderMessage(compose), compose.message)
})

test('renderMessage() builds a fix message with the error and broken code', () => {
  const rendered = renderMessage(fix)
  assert.match(rendered, /can you fix it\?/)
  assert.match(rendered, /lpd is not a function/)
  assert.match(rendered, /```strudel\ns\("bd"\)\.lpd\(1\)\n```/)
})

test('renderMessage() uses a fix case\'s own message when it has one', () => {
  const rendered = renderMessage({ ...fix, message: 'Please help, this is broken' })
  assert.match(rendered, /^Please help, this is broken/)
})
