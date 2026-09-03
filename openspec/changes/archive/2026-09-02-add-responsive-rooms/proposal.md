## Why

On a phone — especially held vertically — the JAM room and Composition
Room screens break in specific, avoidable ways: part of the header menu
renders literally on top of the logo, and you have to scroll the editor
**horizontally** to read your own code. The tool has to degrade
gracefully to a phone before it's shown to dev friends, let alone an
investor. It's also a prerequisite for the `@jah` roadmap — chat is a
mobile-first interaction.

## What Changes

- **Room header reflows.** In both room screens (`/app/jam/room/[id]`,
  `/app/composition/[id]`) the top bar adapts to the viewport — controls
  wrap or move into an overflow menu rather than overlapping the logo or
  each other. Every control stays reachable at any width down to a
  narrow phone.
- **The code editor never scrolls horizontally on a narrow viewport.**
  Long lines soft-wrap; code is read by scrolling vertically. Vertical
  scroll is fine; horizontal scroll to see the end of a line is not.
- **Sharing a room is one tap.** "Copy invite link" becomes a **Share**
  action that uses the device's native share sheet (`navigator.share`)
  where available, so a link goes to a friend in one gesture;
  copy-to-clipboard stays as the fallback on desktop.
- The room layouts use dynamic viewport units so mobile browser chrome
  doesn't clip the bottom of the screen.

Non-goals: a full site-wide responsive audit (landing, docs, pattern
library are out of scope here), and any change to what the controls
*do*, what sharing *produces*, or how editing *works* — only how they
present across viewport sizes.

## Capabilities

### New Capabilities
- `responsive-rooms`: the JAM room and Composition Room screens adapt to
  the viewport — controls stay reachable and unobstructed, code stays
  readable without horizontal scrolling, and sharing a room is a single
  action — down to a phone held vertically.

### Modified Capabilities
<!-- none — the behavior of the controls, of sharing, and of editing is
     unchanged; only their presentation across viewport sizes, which no
     existing spec constrains. -->

## Impact

- **Code**: `app/pages/app/jam/room/[id].vue` and
  `app/pages/app/composition/[id].vue` (headers, layout units);
  `app/components/TrackEditor.vue` and `app/lib/strudelEditor.ts`
  (CodeMirror line wrapping); the "copy invite link" handlers in both
  room pages (add `navigator.share`).
- **Tests**: new Playwright coverage at a phone viewport (portrait) —
  header controls don't overlap, editor content width ≤ viewport,
  share/copy affordance present.
- **No** dependency, schema, protocol, or server changes.
