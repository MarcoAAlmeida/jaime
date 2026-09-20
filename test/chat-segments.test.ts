import { describe, expect, it } from 'vitest'
import { splitReply } from '../app/lib/chatSegments'

// add-jah-code-cards — an @jah reply splits into text and code segments;
// Strudel fences become cards, everything else stays Markdown text.

const FENCE = '```'
const fence = (label: string, ...code: string[]) => [`${FENCE}${label}`, ...code, FENCE].join('\n')

describe('splitReply', () => {
  it('splits prose followed by a strudel fence into text then code', () => {
    const reply = `.fast(2) plays twice as quickly:\n\n${fence('strudel', 's("bd sd").fast(2)')}`
    expect(splitReply(reply)).toEqual([
      { kind: 'text', text: '.fast(2) plays twice as quickly:' },
      { kind: 'code', code: 's("bd sd").fast(2)' },
    ])
  })

  it('keeps order for two fences with text between them', () => {
    const reply = [
      'First:',
      fence('strudel', 's("bd")'),
      'Then:',
      fence('strudel', 's("sd")'),
      'Done.',
    ].join('\n\n')
    expect(splitReply(reply)).toEqual([
      { kind: 'text', text: 'First:' },
      { kind: 'code', code: 's("bd")' },
      { kind: 'text', text: 'Then:' },
      { kind: 'code', code: 's("sd")' },
      { kind: 'text', text: 'Done.' },
    ])
  })

  it('returns one text segment when there is no fence', () => {
    expect(splitReply('Just `.fast(2)` inline, no block.')).toEqual([
      { kind: 'text', text: 'Just `.fast(2)` inline, no block.' },
    ])
  })

  it('returns nothing for an empty reply', () => {
    expect(splitReply('')).toEqual([])
    expect(splitReply('  \n\n ')).toEqual([])
  })

  it('accepts an unlabelled fence, js, and javascript as Strudel', () => {
    for (const label of ['', 'js', 'javascript', 'JavaScript']) {
      expect(splitReply(fence(label, 's("bd")')), JSON.stringify(label)).toEqual([
        { kind: 'code', code: 's("bd")' },
      ])
    }
  })

  it('drops a stray label on the first line inside the fence', () => {
    for (const label of ['strudel', 'js', 'javascript']) {
      expect(splitReply(fence('', label, 's("bd sd")')), label).toEqual([
        { kind: 'code', code: 's("bd sd")' },
      ])
    }
    // ...also when the fence itself carries a label and repeats it.
    expect(splitReply(fence('strudel', 'strudel', 's("bd")'))).toEqual([
      { kind: 'code', code: 's("bd")' },
    ])
  })

  it('does not drop a first line that merely starts with the label', () => {
    expect(splitReply(fence('strudel', 'strudelish("x")'))).toEqual([
      { kind: 'code', code: 'strudelish("x")' },
    ])
  })

  it('leaves other languages as ordinary Markdown text', () => {
    const reply = `Try this:\n\n${fence('python', 'print("hi")')}\n\nOr that.`
    expect(splitReply(reply)).toEqual([{ kind: 'text', text: reply }])
  })

  it('leaves a fence nested in a list as text', () => {
    const reply = `1. Do this:\n\n   ${FENCE}strudel\n   s("bd")\n   ${FENCE}\n\n2. Then that.`
    expect(splitReply(reply)).toEqual([{ kind: 'text', text: reply }])
  })

  it('makes no card for an empty fence, or one holding only a label', () => {
    expect(splitReply(`Before\n\n${fence('strudel')}\n\nAfter`)).toEqual([
      { kind: 'text', text: `Before\n\n${fence('strudel')}\n\nAfter` },
    ])
    expect(splitReply(fence('', 'strudel'))).toEqual([
      { kind: 'text', text: fence('', 'strudel') },
    ])
  })

  it('keeps text segments as the original Markdown, not a re-serialisation', () => {
    const prose = '**Bold** and _italic_, a list:\n\n- one\n- two\n\n> quoted'
    const segments = splitReply(`${prose}\n\n${fence('strudel', 's("bd")')}`)
    expect(segments[0]).toEqual({ kind: 'text', text: prose })
  })

  it('runs an unclosed fence to the end of the reply', () => {
    expect(splitReply(`Here:\n\n${FENCE}strudel\ns("bd")\ns("sd")`)).toEqual([
      { kind: 'text', text: 'Here:' },
      { kind: 'code', code: 's("bd")\ns("sd")' },
    ])
  })

  it('handles CRLF line endings', () => {
    expect(splitReply(`Hi\r\n\r\n${FENCE}strudel\r\ns("bd")\r\n${FENCE}\r\n`)).toEqual([
      { kind: 'text', text: 'Hi' },
      { kind: 'code', code: 's("bd")' },
    ])
  })

  it('keeps hostile content inert — it is only ever data in a code segment', () => {
    const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>\n$(rm -rf /)'
    const segments = splitReply(fence('strudel', evil))
    expect(segments).toEqual([{ kind: 'code', code: evil }])
  })

  it('keeps hostile prose as text (it is escaped later by the chat renderer)', () => {
    const segments = splitReply('<script>alert(1)</script>')
    expect(segments).toEqual([{ kind: 'text', text: '<script>alert(1)</script>' }])
  })
})
