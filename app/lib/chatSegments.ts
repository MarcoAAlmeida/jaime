import { parseChatMarkdown } from './chatMarkdown'

// Splits an @jah reply into text and code segments (add-jah-code-cards,
// design decision 2). The chat shows text through `ChatMarkdown` as today
// and each Strudel fence as a card. Pure and tolerant: the model's
// formatting is not guaranteed, so slips are absorbed here rather than
// asked of the prompt.
//
// Text segments are slices of the ORIGINAL Markdown source (located by the
// fence tokens' line ranges), not a re-serialisation — so everything that
// is not a card renders exactly as it did before.

export type ReplySegment =
  | { kind: 'text', text: string }
  | { kind: 'code', code: string }

/** Fence labels that mean "Strudel" — plus no label at all. */
const STRUDEL_LABELS = new Set(['strudel', 'js', 'javascript', ''])

/** The model sometimes writes the label on the first line INSIDE the fence. */
const STRAY_LABEL = /^\s*(strudel|js|javascript)\s*$/i

/**
 * The code a fence should show, or null when it is not a Strudel card:
 * another language, or nothing left after dropping a stray label line.
 */
function cardCode(info: string, content: string): string | null {
  const label = info.trim().split(/\s+/)[0]!.toLowerCase()
  if (!STRUDEL_LABELS.has(label)) return null

  const lines = content.replace(/\n+$/, '').split('\n')
  if (lines.length > 0 && STRAY_LABEL.test(lines[0]!)) lines.shift()

  const code = lines.join('\n').replace(/^\n+/, '')
  return code.trim() === '' ? null : code
}

export function splitReply(reply: string): ReplySegment[] {
  // markdown-it normalises newlines before parsing; line ranges refer to that.
  const source = reply.replace(/\r\n?/g, '\n')
  const lines = source.split('\n')

  const segments: ReplySegment[] = []
  let cursor = 0 // first source line not yet emitted

  const pushText = (from: number, to: number) => {
    const text = lines.slice(from, to).join('\n').replace(/^\n+|\n+$/g, '')
    if (text.trim() !== '') segments.push({ kind: 'text', text })
  }

  for (const token of parseChatMarkdown(source)) {
    // Top-level fences only: a fence inside a list or quote stays in its text.
    if (token.type !== 'fence' || token.level !== 0 || !token.map) continue

    const code = cardCode(token.info, token.content)
    if (code === null) continue

    const [start, end] = token.map
    pushText(cursor, start)
    segments.push({ kind: 'code', code })
    cursor = end
  }

  pushText(cursor, lines.length)
  return segments
}
