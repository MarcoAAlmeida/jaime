## Context

See proposal.md — Why. The Chat tab (`app/pages/app/composition/[id].vue`)
holds a roster, a hand-rolled log (`chat` ref of `ChatMessage`, a
`div` with manual scroll handling) and a one-line `UInput`. The wire
message is `{ clientId, name, text, at, avatarUrl? }`; the server
broadcasts it and replays up to 200 in the `welcome` payload. Existing
tests hang off `data-testid`s (`chat-input`, `chat-send`,
`chat-message-row`, `chat-message`, `jah-typing`, `chat-panel`,
`chat-log`) and off row text like `"Alice: hey room"`.

Nuxt UI 4.10's chat components were read from the installed source:

- `UChatMessages` takes `messages` shaped `{ id, role, parts, metadata }`
  and spreads role defaults (`user`: right/soft, `assistant`:
  left/naked) **under** each message's own props, so a per-message
  `side`, `variant`, `color`, `avatar` overrides the role. A message
  with no `parts` is skipped.
- Its `status` prop drives a built-in typing indicator, but also a
  scroll behavior designed for one-user-one-assistant chat (see
  decision 3).
- `UChatPrompt` is a form + textarea (`submitOnEnter`, Shift+Enter for
  newline, `autoresize`, `#footer` slot); `UChatPromptSubmit` is its
  send button.
- `UChatShimmer` is a text shimmer, useful for "thinking…".

## Goals / Non-Goals

**Goals:**

- Adopt the Nuxt UI chat components for the log and the input, with the
  behavior in the two spec deltas.
- Keep the wire format for messages unchanged; keep existing testids
  meaningful.
- Make the Markdown safety properties (spec) verifiable by tests, not
  by trusting a library's defaults.

**Non-Goals:**

- Real model switching, private messages, file upload.
- Syntax highlighting for code blocks (v1 renders them plain).
- Any change to `@jah`'s server-side gating, caps, kill switch, or
  statelessness.

## Decisions

### 1. Client-side mapping layer, no message wire change

A small pure function (`app/lib/chatMessages.ts`) maps `ChatMessage[]`
plus "who am I" into `UChatMessages`' shape:

- `id`: `${at}-${clientId}-${index}` — stable across appends (the log
  only ever grows or resets wholesale), unique enough within a room.
- `parts`: `[{ type: 'text', text }]`.
- Role/side: the viewer's own → `role: 'user'`, `side: 'right'`,
  soft; other humans → `role: 'user'`, `side: 'left'`, a quieter
  variant; `@jah` (`clientId === '@jah'`) → `role: 'assistant'`,
  `side: 'left'`, its own variant/color and `/jah-avatar.svg`.
- Avatar: `{ src, alt, text }` from `avatarUrl`/name — the same
  initial-fallback behavior `UserAvatar` gives today.
- Sender name goes in the message `#header` slot, hidden on the
  viewer's own messages (right-aligned bubbles need no name);
  Markdown goes in `#content`. Extra fields (`name`, `at`) ride in
  `metadata`.

Being pure, the mapping is unit-testable without mounting anything.

**As built:** the viewer's own bubble carries no avatar (it is on the
right, in the accent colour); everyone else's avatar is `xs` — the
`compact` default (16px) is too small to read a face or the lion. The
`outline` variant colours its text too, so `@jah`'s body text is reset to
the default colour and only the border carries the assistant colour
(`secondary`, never `error`). Variants: own `soft`/`primary`, others
`subtle`/`neutral`, `@jah` `outline`/`secondary`. `UChatMessages`' own
jump-to-bottom button is turned off (`:auto-scroll="false"`): it anchors
absolutely inside the scroller and would ride along with the content.

**Alternative rejected:** adding `role`/`id` to the wire message — it
would couple the protocol to a UI library's shape for no gain.

### 2. "Mine" is decided by `clientId`; the reconnect wrinkle is accepted

The client already knows its own `clientId` from `welcome`. A
reconnect gets a new one, so this connection's earlier messages,
replayed in the next `welcome`, show as other people's. That is
accepted for v1: chat is ephemeral, reconnects are rare, and the
alternatives are worse — putting `userId` on the wire leaks account ids
to every participant, and a per-connection secret to prove ownership is
disproportionate machinery. Two tabs of one account likewise see each
other's messages as "others'", which is arguably right.

### 3. The typing bubble is a synthetic message, not `status="submitted"`

`UChatMessages`' `status` prop would give a free indicator, but
`status="submitted"` also scrolls the **last user-role message to the
top of the viewport** and reserves filler height under it — right for a
personal chat, wrong for a shared room where the "last user message"
may be someone else's and `@jah` typing is triggered by anyone. So the
log appends a synthetic `assistant` message (`id: 'jah-typing'`,
`metadata.typing`) while `jahTyping` is true, rendering
`<UChatShimmer text="@jah is thinking…">` in `#content`, carrying
`data-testid="jah-typing"`. The status prop is left unset. Same
observable behavior as the spec asks for, none of the scroll side
effects.

### 4. Scrolling stays ours

(As built, the log is also reset at the start of every `welcome` — the
provider emits a `clientId` event first — because the `welcome` replays
the whole log and the page previously appended it to what was already
there, so every reconnect showed each message twice. Pre-existing bug,
fixed here because the reset and the "which clientId is mine" refresh are
the same event.)

`UChatMessages` auto-scrolls only while `status === 'streaming'`. New
messages arrive without streaming, so the existing "scroll the log to
the bottom on a new message" behavior is kept, targeting the wrapping
scroll container (which `UChatMessages` also discovers as its scroll
parent for its jump-to-bottom button). A user who has scrolled up to
read is **not** yanked down: only auto-scroll when they were already
near the bottom, or when the message is their own.

### 5. Input, and its footer

`UChatPrompt` with `autofocus` **off** (auto-focusing would pop the
mobile keyboard on entering a room — Chat is now the default tab) and
`UChatPromptSubmit` always `status="ready"` (a stop/reload button makes
no sense in a room chat). Enter sends, Shift+Enter newline, empty/
whitespace not sent — all the component's own behavior, asserted by e2e.
Existing testids move onto the new elements (`chat-input` on the
textarea, `chat-send` on the submit button).

The `#footer` holds, left to right: the model selector placeholder and
the "to `@jah`" switch.

- **Model selector**: built as a ghost `UButton` labelled "@jah
  default" with a chevron, whose click calls `useToast().add(...)` with
  a "not implemented yet" notice. No state. (A `USelect`/`USelectMenu`
  was the first idea, but opening a menu and *then* toasting reads as a
  bug; the button says "not yet" with nothing to dismiss.)
- **"To @jah" switch**: a `USwitch` + label. On send, if on and the
  text doesn't already address `@jah`, prepend `"@jah "`. "Addresses"
  is the server's `classifyMention` rule exactly — first
  whitespace-delimited token equals `@jah`, case-insensitively — NOT
  `^@jah\b`: `@jah, hi` is not addressed server-side, so a `\b` rule
  would skip the prefix on a message that then never reaches `@jah`.
  Lives in `app/lib/jahMention.ts`; a parity test asserts every output
  is classified as addressed by the server function. Sticky
  within the page session (a `ref`, not persisted); resets on reload.

### 6. Availability travels on `welcome`

`welcome` gains `jah: 'available' | 'signed-out' | 'no-access' |
'disabled'`, computed in the `join` handler from values it already has:
`isJahEnabled(env)` first (→ `disabled`, regardless of the user), then
`account` presence (→ `signed-out`), then `account.aiAccess`
(→ `no-access`), else `available`. It is **informational only**: the
`chat` handler's gating is untouched and remains the authority, so a
stale or spoofed client can't grant itself anything. Staleness matches
add-jah-chat decision 1 (resolved once at join). `compositionProvider`
exposes it via a new `jah` event/value; the switch's disabled reason
text is derived client-side from the enum.

**Alternative rejected:** a separate `GET /api/jah/availability` — one
more round trip and a second auth path for information the join
handler already has in hand.

### 7. Markdown: Comark preferred, gated by a spike, `markdown-it` as the fallback

The spec's safety requirements (no raw HTML, no remote images,
http/https-only links with `noopener noreferrer`, preserved single
newlines) are **behavioral and non-negotiable**; the library is not.
Comark's public docs (0.7.x, pre-1.0) say nothing about raw-HTML
handling, image control, link-scheme restriction, or soft-break
behavior. So task 1 is a spike: render hostile inputs through
`@comark/nuxt` and check each spec scenario. If Comark can be
configured to meet all of them, use it (aligned with Nuxt UI's chat
docs and its `Prose*` component override for links/images). If not,
use `markdown-it` with `html: false`, `breaks: true`, its built-in
`validateLink` (rejects `javascript:`/`vbscript:`/`data:`), and a
renderer override that drops images to their alt text and forces
`target="_blank" rel="noopener noreferrer"` on links — rendered with
`v-html` **only** from that configured instance's output. Either way
the safety scenarios become automated tests (component-level, plus one
e2e), because "the library is safe by default" is exactly the claim
being distrusted.

A single `<ChatMarkdown :text>` component wraps whichever renderer wins,
so the choice is one file.

**Spike outcome (task 1): `markdown-it`.** Hostile inputs were run
through `comark@0.7.0`'s parser and through `markdown-it@14`
(`html:false`, `breaks:true`, `linkify:true`):

- Comark **defaults fail the spec three ways**: `<script>` and
  `<img onerror>` become real element nodes; MDC component syntax
  (`::alert{…}`, `:icon{…}`) instantiates components a participant
  names; and `[a](url){onclick="…"}` injects arbitrary attributes onto
  links. It is safe only with the non-default
  `registerDefaultPlugins: false`, and even then remote images come
  through as `img` nodes needing a `Prose` override. The library is
  0.x and its docs are silent on all of this; a security property that
  hinges on remembering to switch a default off, through a module we
  can't pin the behaviour of, is the wrong basis.
- `markdown-it` is safe by default: raw HTML is escaped to text,
  `javascript:` links are left as plain text, MDC/attribute syntax is
  inert text, `breaks:true` keeps single newlines. Only images (drop to
  alt text) and link attributes (`target`/`rel`) need renderer rules.
- Bundle: parser alone, minified — Comark 256 KB / 100 KB gzip (before
  its Vue renderer); markdown-it 149 KB / 52 KB gzip.

Both render the Strudel probe (`bd*4 hh*8`, `_pitchwheel`, `<a b>`, `~`)
identically mangled outside code; inside backticks/fences it is exact.

**Strudel vs Markdown**: Strudel/mini-notation is full of Markdown
metacharacters (`bd*4 hh*8` → italics, `_pitchwheel`, `<a b>`, `~`).
Bare Strudel in a message will sometimes render mangled; inside
backticks or a fence it renders exactly as typed. Accepted — the user
chose Markdown for all messages. Mitigation is documentation-in-UI: the
prompt's placeholder hints "Markdown supported — wrap code in `backticks`".
Code blocks are plain (no highlighting) in v1.

### 9. `@jah`'s avatar: a red lion, baked into the existing static SVG

`public/jah-avatar.svg` is replaced in place with the game-icons.net
`lion` icon (Lorc, CC BY 3.0) recoloured red on a round badge. Same
path, so the server constant, the mapping, the roster/chat consumers
and the existing tests that match `/jah-avatar\.svg/` are untouched.

- **Not rendered through `UIcon`.** The avatar is an `<img>` of a
  static file, so the icon's path data is copied into the SVG once,
  offline. That keeps `GAME_ICONS_IN_USE` empty and the Worker at its
  baseline size — nothing from the collection is bundled for it.
- **Red is deliberate, and not the `error` colour.** Red is the lion's
  identity; the assistant bubble variant/colour (decision 1) must not
  be Nuxt UI's `error`, or replies would read as failures. The badge
  is the only place the red appears.
- **"Rounded"** is read as a circular badge (matching the current
  avatar and `UAvatar`'s circle crop), with the lion inside it — the
  glyph's own shape is not altered. Colours to be confirmed against
  the rendered result, in both light and dark themes.
- **Attribution (CC BY 3.0, per the `icon-library` spec).** Because the
  icon is used, `content/credits/game-icons.md` gets a `lion` row
  (author Lorc, source URL), and the credit is shown inline where the
  avatar is shown: the `@jah` avatar carries a tooltip/`title` naming
  the artist and licence, and the SVG file itself carries the
  attribution in its metadata. The recolouring is a modification, so
  the credit says so.

### 8. Testids and tests

`chat-message-row` goes on each `UChatMessage` root (via the mapped
message object), `chat-message` on the content element,
`chat-log` on the scroll container, `chat-panel` unchanged. Row text is
no longer `"Alice: hey room"` (the name lives in the header and is
hidden on one's own messages), so e2e assertions that matched on the
combined string are rewritten to match on the message text, and on the
name only where it is shown — a deliberate update, not a testid
workaround. `jah-typing` is preserved on the synthetic typing bubble.
Pool-workers tests that read `welcome` gain an assertion for `jah`.

## Risks / Trade-offs

- **[Comark can't meet the safety scenarios]** → the spike decides;
  `markdown-it` fallback is fully specified above, so this delays
  nothing, it just picks the library.
- **[Markdown mangles Strudel pasted without backticks]** → accepted
  and hinted in the placeholder; not a security issue, a formatting
  one.
- **[Stale availability]** → the switch may be enabled after access is
  revoked (or disabled after it's granted) until rejoin; harmless,
  since the server re-checks every message. Same trade-off as
  add-jah-chat decision 1.
- **[`UChatMessages` is built for AI chat]** → we use it outside its
  intended one-user shape; decision 3 removes the one behavior that
  misfires. Any other rough edge found during implementation is
  handled by overriding the slot, not by forking behavior.
- **[Bundle size]** → a markdown renderer adds weight to a route that
  is already heavy (Strudel, CodeMirror, Yjs); the Chat tab is the
  default landing tab, so this is on the critical path. Measure the
  before/after of the composition route chunk in the spike and prefer
  the lighter option if the safety result is otherwise equal.
- **[Mobile]** → the bottom tab bar already reserves space via the
  panel's `pb-[calc(3.5rem+env(safe-area-inset-bottom))]`; the prompt
  must sit above it and the textarea's growth must be capped
  (`maxrows`) so it can't push the log off-screen at phone height.

## Migration Plan

No data or schema change. Deploy is ordinary (`npm run deploy`).
Rollback is redeploying the previous version; the one protocol
addition (`welcome.jah`) is additive and ignored by an older client.
