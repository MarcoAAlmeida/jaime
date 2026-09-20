## Why

Chat is now the Composition Room's first and default tab and the only
way to reach `@jah`, but it is still a bare list of `Name: text` lines
above a one-line input. `@jah`'s replies look identical to a human's,
the input can't hold more than one line (no Shift+Enter, so no pasted
code), nothing in the UI tells anyone `@jah` exists beyond a one-time
welcome line, and code/backticks in replies render as literal text.
Nuxt UI (already installed, v4.10) ships purpose-built chat components
that fix all of this without us hand-rolling more.

## What Changes

- **Message log** becomes `UChatMessages`/`UChatMessage`: the viewer's
  own messages on the right in a soft bubble, everyone else's on the
  left, and `@jah` styled as the "assistant" (distinct bubble variant,
  its own avatar). Done as a client-side mapping of our existing chat
  messages — the message wire format doesn't change.
- **`@jah`'s avatar** becomes a red, rounded lion — the
  game-icons.net "lion" icon (by Lorc, CC BY 3.0), replacing the
  placeholder green sparkle. It stays the same static file at the same
  path, so nothing that references it changes; the change is the
  artwork, plus the attribution the licence requires.
- **`@jah` typing indicator** becomes an assistant-style bubble in the
  log (with `@jah`'s avatar and a shimmering "thinking…"), replacing the
  italic "`@jah` is thinking…" line, still driven by the existing
  `jah_typing` signal.
- **Input** becomes `UChatPrompt` + `UChatPromptSubmit`: multi-line,
  auto-growing, Enter sends, Shift+Enter inserts a newline.
- **Prompt footer** gains two controls:
  - a **model selector placeholder** — opening it only shows a
    "not implemented yet" toast (real model switching is a later change);
  - a **"to `@jah`" switch**: when on, the client prepends `@jah ` to
    the outgoing text. The message stays public to the whole room,
    exactly as if typed by hand. Default off. Disabled, with a hint,
    when `@jah` isn't available to the user (anonymous, no access,
    or the kill switch is off).
- **Availability signal**: the composition `welcome` server message
  gains a field telling the client whether `@jah` is available to this
  connection (`available` / `signed-out` / `no-access` / `disabled`),
  computed server-side at join. Needed because the allowlist and kill
  switch are server-side only.
- **Markdown in every message** — human and `@jah` — rendered safely:
  no raw HTML, no remote images, http(s)-only links opened with
  `noopener noreferrer`, and single line breaks preserved. Adds a new
  dependency (or a fallback renderer — see design).

Out of scope: real model switching, private/direct messages, file
upload, any change to `@jah`'s server-side gating, caps, or kill
switch.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `composition-room`: "Ephemeral Room Chat" changes how messages are
  presented (own vs others, markdown) and adds multi-line input.
- `jah-chat`: `@jah`'s messages become visually distinct from
  human messages; adds the "to `@jah`" mode, the model-selector
  placeholder, and the availability signal that disables the mode.

## Impact

- **Code**: the chat panel in `app/pages/app/composition/[id].vue`
  (log, input, typing line); `app/lib/compositionProvider.ts` (reads the
  new `welcome` field); `shared/compositionProtocol.ts` and
  `server/routes/composition.ts` (the one protocol addition).
- **Dependencies**: a markdown renderer — `@comark/nuxt` (0.7.x,
  pre-1.0) preferred to stay aligned with Nuxt UI's chat docs, with
  `markdown-it` (`html: false`) as the fallback if Comark can't
  guarantee the safety requirements. Decided by a short spike, see
  design.
- **Tests**: existing e2e (`chat-input`, `chat-send`,
  `chat-message-row`, `chat-message`, `jah-typing`, `chat-panel`
  testids) and pool-workers `welcome` assertions need to keep passing or
  be updated deliberately.
- No change to JAM, the Pattern library, or `@jah`'s server-side rules.
