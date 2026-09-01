## Why

JAM runs a deliberately-curated slice of Strudel: the built-in synth
waveforms plus the `dirt-samples` bank, one pattern per track, no
visuals, no mini-notation highlight. That was the right call for a first
shippable tool, but it has hardened into a ceiling — the "Strudel in
JAM" docs page now describes limits that were never design decisions,
and Phase 6's Composition Room will need the real thing anyway.

This change lifts the **one** audio + editor engine both tools share to
strudel.cc parity, so JAM stops being the narrowed one and the
Composition Room (a separate change) can build straight on top of it.

It was split out of `add-composition-room` — the engine work is
invasive (it touches the playback path every JAM test exercises) and
worth landing and baking on its own before the collaborative-editing
work depends on it.

## What Changes

- **The full strudel.cc default sample map**, not just `dirt-samples` —
  a pattern naming any sample from that map produces sound. Lazy-loaded
  like the current bank; a synth-only pattern still plays without
  waiting.
- **`$:` / labelled multi-pattern documents** (`$drums: …`, `$bass: …`)
  — every label plays together; muting a label is the Strudel-native
  `_` prefix (a no-re-eval mixer UI is a later change).
- **`setcps` / `setcpm` honoured from the document.** (A JAM room's
  transport start-aligns tracks but does not yet override a per-track
  `setcps` — strict shared-clock ownership is the `composition-room`
  capability's concern.)
- **Mini-notation event highlighting** in the editor — the token(s)
  being triggered light up in time with the audio, cleared on stop.
- **Pattern-driven visuals deferred** — the engine now loads
  `@strudel/draw` so `.punchcard()` / `.pianoroll()` don't error, but
  nothing renders yet; a later change adds the editor-backdrop canvas
  strudel.cc uses.
- The **"Strudel in JAM"** docs page is rewritten as "Strudel in
  jaime": the "curated subset / leaves out" framing goes; an honest
  short list of the real remaining exceptions stays.
- **Out of scope, noted:** Hydra / WebGL video synthesis, MIDI/OSC,
  loading arbitrary sample banks via `samples('github:…')` from inside
  a tool. Collaborative editing is `add-composition-room`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `frontend-editor`: the Strudel engine and editor gain full
  strudel.cc parity — an expanded default sample set, labelled
  multi-pattern (`$:`) documents, document `setcps`, mini-notation
  event highlighting. (Pattern-driven visuals deferred.) Existing
  behaviour (per-track editing, "every curated pattern plays",
  invalid-pattern handling) is unchanged; the "curated subset" framing
  is dropped.

## Impact

- **New**: `@strudel/draw` promoted to a direct dependency (was
  transitive); `app/lib/prebake.ts` registering the full sample map; a
  draw-canvas mount alongside each editor.
- **Changed**: `app/lib/audioEngine.ts` (rework onto
  `@strudel/codemirror`'s `StrudelMirror` — or a parity-augmented repl,
  see design.md), `app/components/TrackEditor.vue` / a shared editor
  factory (event highlight, widgets), `content/docs/strudel/*`
  (drop the subset framing; adjust the "four basic waveforms" /
  "dirt-samples only" lines).
- **Risk surface**: this touches JAM's playback path — the
  `pattern-playback` e2e ("every curated pattern plays") and
  `multi-client` e2e are the regression guards.
- No D1 / schema change, no realtime-protocol change, no API change.
- `add-composition-room` is rebased to assume this engine exists.
