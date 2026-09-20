import { describe, expect, it } from 'vitest'
import { renderChatMarkdown } from '../app/lib/chatMarkdown'

// The composition-room spec's "Chat Messages Render Markdown Safely"
// requirement, one test per scenario. The output is injected with v-html,
// so these are the guard rails — not a library's defaults.
describe('renderChatMarkdown — spec scenarios', () => {
  it('formats inline code and fenced blocks, text exactly as typed', () => {
    const html = renderChatMarkdown('use `s("bd*4 hh*8")` here\n```\nd1 $ s "bd*4 hh*8"\n```')
    expect(html).toContain('<code>s(&quot;bd*4 hh*8&quot;)</code>')
    expect(html).toContain('<pre><code>d1 $ s &quot;bd*4 hh*8&quot;\n</code></pre>')
    // Nothing inside code is turned into emphasis.
    expect(html).not.toContain('<em>')
  })

  it('shows raw HTML as literal text, never as an element', () => {
    for (const hostile of [
      '<script>alert(1)</script>',
      '<img src=x onerror="alert(1)">',
      'hi <b onmouseover=alert(1)>there</b>',
      '<iframe src="https://evil.example"></iframe>',
      '<a href="javascript:alert(1)">x</a>'
    ]) {
      const html = renderChatMarkdown(hostile)
      // No element the participant typed survives as markup. (A literal
      // http(s) URL inside the text may still be linkified — that is an
      // ordinary, safe link — so only *their* tags and hrefs are checked.)
      expect(html, hostile).not.toMatch(/<(script|img|iframe|b)[\s>]/i)
      expect(html, hostile).not.toMatch(/href="javascript:/i)
      expect(html, hostile).not.toMatch(/<[^>]*\son\w+=/i)
      expect(html, hostile).toContain('&lt;')
    }
    // The text is still shown, as text.
    expect(renderChatMarkdown('<img src=x onerror="alert(1)">'))
      .toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  })

  it('never emits an image, so no remote request can be made', () => {
    const html = renderChatMarkdown('![cat](https://evil.example/p.png) and ![](https://evil.example/q.png)')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('src=')
    // Alt text is what remains; the URL itself is not shown as a link.
    expect(html).toContain('cat')
    expect(html).not.toContain('<a ')
  })

  it('follows only http and https links', () => {
    expect(renderChatMarkdown('[ok](https://example.com/x?y=1)')).toContain('href="https://example.com/x?y=1"')
    expect(renderChatMarkdown('[ok](http://example.com)')).toContain('href="http://example.com"')
    expect(renderChatMarkdown('see https://example.com now')).toContain('href="https://example.com"')

    for (const bad of [
      '[x](javascript:alert(1))',
      '[x](JaVaScRiPt:alert(1))',
      '[x](data:text/html;base64,PHNjcmlwdD4=)',
      '[x](vbscript:msgbox(1))',
      '[x](mailto:a@b.co)',
      '[x](ftp://example.com/f)',
      '[x](/relative/path)',
      '<javascript:alert(1)>'
    ]) {
      const html = renderChatMarkdown(bad)
      expect(html, bad).not.toContain('<a ')
      expect(html, bad).not.toContain('href=')
    }
  })

  it('opens every link in a new context without opener or referrer', () => {
    const html = renderChatMarkdown('[a](https://example.com) https://example.org')
    const anchors = html.match(/<a [^>]*>/g) ?? []
    expect(anchors).toHaveLength(2)
    for (const a of anchors) {
      expect(a).toContain('target="_blank"')
      expect(a).toContain('rel="noopener noreferrer"')
    }
  })

  it('cannot smuggle attributes onto a link', () => {
    const html = renderChatMarkdown('[a](https://x.com){onclick="alert(1)" target="_self"}')
    const anchor = (html.match(/<a [^>]*>/) ?? [''])[0]
    expect(anchor).not.toContain('onclick')
    expect(anchor).toContain('target="_blank"')
    expect(anchor).not.toContain('_self')
  })

  it('does not treat component / frontmatter syntax as anything', () => {
    const html = renderChatMarkdown('::alert{type="info"}\nhello\n::\n:icon{name="x"}')
    expect(html).not.toMatch(/<(alert|icon)/)
  })

  it('preserves single line breaks, including unfenced pasted code', () => {
    const html = renderChatMarkdown('line one\nline two\nline three')
    expect(html.match(/<br>/g)).toHaveLength(2)
    expect(html).toContain('line one')
    expect(html).toContain('line three')
  })

  it('does not linkify bare dotted identifiers from Strudel code', () => {
    const html = renderChatMarkdown('s("bd").fast(2) and note("c").sound.gain')
    expect(html).not.toContain('<a ')
  })

  it('formats emphasis and lists', () => {
    expect(renderChatMarkdown('**bold** and *it*')).toContain('<strong>bold</strong>')
    expect(renderChatMarkdown('- one\n- two')).toContain('<li>one</li>')
  })

  it('escapes quotes in a code fence language so it cannot break out', () => {
    const html = renderChatMarkdown('```"><script>alert(1)</script>\nx\n```')
    expect(html).not.toContain('<script')
  })
})
