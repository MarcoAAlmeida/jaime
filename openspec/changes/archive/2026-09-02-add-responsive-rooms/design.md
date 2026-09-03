## Context

See `proposal.md` — Why. Current state:

- Both room screens are `definePageMeta({ layout: false })` full-screen
  Vue pages with a hand-built flex header: `app/pages/app/jam/room/[id].vue`
  and `app/pages/app/composition/[id].vue`. The Composition Room header
  already carries the most controls (connection badge, Play/Stop, Load a
  starter, Switch role, Copy invite, People/chat toggle) — it's the one
  that overlaps the logo on a narrow viewport. Its outer wrappers were
  recently moved from `h-screen` to `h-dvh`.
- The editor is `@strudel/codemirror`'s `StrudelMirror`, created once
  per instance by `createStrudelEditor(opts)` in `app/lib/strudelEditor.ts`.
  Extensions are appended after construction via
  `StateEffect.appendConfig` (the pattern used for the editable
  `Compartment`). No line wrapping is configured, so CodeMirror
  horizontally scrolls long lines.
- "Copy invite link" in both rooms is a button calling
  `navigator.clipboard.writeText(window.location.href)` then flashing
  "Copied!".

## Goals / Non-Goals

**Goals** — beyond the spec: make the header reflow with the platform's
own primitives (CSS + the existing Nuxt UI components), not a bespoke
breakpoint system; keep desktop behaviour byte-identical.

**Non-Goals**: a responsive pass on landing / docs / pattern library;
a design-token or breakpoint overhaul; touching anything server-side.

## Decisions

### 1. Line wrapping is a Compartment toggled by width, not always on

The spec requires wrapping on narrow viewports **and** "wide viewport is
unaffected — lines are not force-wrapped". `EditorView.lineWrapping`
applied unconditionally fails the second half. So: put
`EditorView.lineWrapping` in a `Compartment`, appended alongside the
editable compartment, and `reconfigure` it from a `ResizeObserver` on
the editor host — wrapping on below a threshold (the same observer
`TrackEditor` / the Composition Room already run for the draw canvas),
off above it.

- **Alternative — a CSS media query on `.cm-content`**: CodeMirror's
  layout is JS-driven; forcing `white-space: pre-wrap` via CSS without
  telling the view desyncs measurement (cursor/selection drift). The
  compartment is the supported path.
- **Alternative — always wrap**: simplest, but the spec forbids it and
  long unwrapped lines are a deliberate affordance on desktop.
- Threshold: a fixed CSS px width (≈ `640px`, Tailwind `sm`), not a
  character count — it's about "does a line fit", and the editors are
  full-width in their pane.

### 2. Header reflows with flex-wrap + an overflow menu, no new breakpoint system

The header is a flex row. Let it `flex-wrap` so controls drop to a
second row before they collide — that alone fixes the logo overlap.
Where a second row is still too tall on a short landscape viewport,
collapse the secondary controls (Load a starter, Switch role, Copy
invite) into a single `UDropdownMenu` "⋯" trigger shown only below a
Tailwind breakpoint; Play/Stop and the connection badge stay inline.

- **Alternative — a dedicated mobile header component**: more code, two
  code paths to keep in sync. flex-wrap + a `sm:hidden` / `hidden sm:flex`
  swap on the overflow menu is enough.

### 3. Share = `navigator.share` with the clipboard as fallback

One handler: `if (navigator.share && navigator.canShare?.({ url }))
navigator.share({ title, url })` else the existing clipboard copy +
"Copied!". `navigator.share` must be called synchronously from the click
(user-activation requirement). Button label: "Share" when `navigator.share`
exists, "Copy invite link" otherwise — decided at mount, not per click.
Same handler in both rooms; factor it into a small composable
(`useShareLink`) so the two rooms don't drift.

### 4. Dynamic viewport units

Room outer wrappers use `h-dvh` (already done in the Composition Room;
apply the same to the JAM room). The Composition Room's chat panel and
the bottom of the editor column additionally get `min-h-0` / safe-area
padding so the chat input clears an overlaying mobile toolbar
(spec: "bottom of the screen is not clipped").

## Risks / Trade-offs

- **CodeMirror re-measures on `lineWrapping` reconfigure** → a visible
  reflow when crossing the threshold (rotating the phone). Acceptable;
  it's a rare event and not a data risk. Debounce the ResizeObserver so
  a drag-resize on desktop doesn't thrash.
- **`navigator.share` rejects if the user dismisses the sheet** → catch
  and ignore `AbortError`; don't fall back to clipboard on a deliberate
  dismiss.
- **The overflow menu hides controls that e2e/tests currently click by
  testid** → the testids move onto the menu items; existing tests that
  assert those controls need the menu opened first at narrow widths.
  Desktop-width tests are unaffected.

## Migration Plan

Pure frontend, additive. Ship behind nothing — it's layout. Rollback is
a revert; no data or protocol state involved.
