import MarkdownIt from 'markdown-it'

// Chat renders every message — from anonymous visitors and from @jah — as
// Markdown (uplift-chat-interface). The HTML produced here is injected
// with `v-html`, so the safety properties in the composition-room spec
// ("Chat Messages Render Markdown Safely") live in THIS configuration and
// are asserted by test/chat-markdown.test.ts; nothing else stands between
// a participant's text and the DOM.
//
//  - `html: false`      raw HTML in a message is escaped to literal text.
//  - `validateLink`     only http(s) links are links; `javascript:`,
//                       `data:`, `mailto:`, relative paths … stay plain
//                       text (markdown-it leaves the source untouched).
//  - image rule         no <img> is ever emitted, so nothing is fetched;
//                       the alt text is shown instead.
//  - link_open          every link opens in a new context with no
//                       opener/referrer.
//  - `breaks: true`     a single newline is a line break, so Shift+Enter
//                       lines and Strudel pasted without a fence keep
//                       their lines.
//  - fuzzy linkify off  bare "hh.fast" / "a.b" in Strudel code is not
//                       turned into a link; only real http(s):// URLs.
const md = new MarkdownIt({ html: false, breaks: true, linkify: true })

md.linkify.set({ fuzzyLink: false, fuzzyEmail: false, fuzzyIP: false })

md.validateLink = url => /^https?:\/\//i.test(url.trim())

md.renderer.rules.image = (tokens, idx) =>
  md.utils.escapeHtml(tokens[idx]!.content)

const defaultLinkOpen = md.renderer.rules.link_open
  ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

/** Render a chat message's Markdown to safe HTML. */
export function renderChatMarkdown(text: string): string {
  return md.render(text)
}
