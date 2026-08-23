# Frontend architecture

## Stack

Vue 3 via Nuxt, with NuxtUI for the app shell (buttons, presence list, room
join form). SSR is disabled for the jam room (`ssr: false`, at least for
that route) — there is nothing meaningful to render server-side, and it
avoids hydration issues around the audio/editor components, which only make
sense in a browser.

## Module breakdown

| Module | Responsibility |
|---|---|
| WebSocket plugin (`.client.ts`) | Connects to the room's Durable Object, sends/receives messages, handles reconnects. Browser-only. |
| `useJamSession()` composable | Holds reactive state: `tracks`, `presence`, clock reference. Updated only by the WebSocket plugin's `onmessage`. Everything else reads from it. |
| `TrackEditor.vue` | Wraps one CodeMirror 6 instance per track. Editable only if the local user owns that track. |
| Audio engine (plain TS module, not a component) | One Strudel scheduler per track, all sharing a single `AudioContext`. Subscribes to clock state imperatively — not driven by Vue's render cycle. |

```
WebSocket client → state store (useJamSession) → TrackEditor components
                                                 → Audio engine (schedulers)
```

Only the WebSocket client talks to the Durable Object. Editors and the audio
engine only ever *read* from the state store.

## Why not React

The app has little traditional UI complexity — a handful of panels, a
presence list, a transport bar. The real complexity is in audio timing and
WebSocket sync, which want direct imperative control (CodeMirror and
Strudel's scheduler both expect to own their own DOM/timing). A heavy
framework adds indirection exactly where the least is wanted. Vue's escape
hatches (`onMounted`, template refs, plain `ref`/`reactive`) stay out of the
way here.

## CodeMirror integration

`TrackEditor.vue` mounts CodeMirror imperatively in `onMounted`, bound to a
`ref<HTMLDivElement>`. Prop changes to the pattern code are applied via a
guarded `watch()` that skips re-applying an update if it originated from
this same editor's own `onUpdate` — otherwise Vue's reactivity and
CodeMirror's own state fight for control of the cursor.

## Styling: keeping Tailwind/NuxtUI and CodeMirror from conflicting

Tailwind's preflight (base CSS reset) applies broadly to all elements,
including ones CodeMirror creates. CodeMirror's own theme styles usually win
on specificity, but only for properties it explicitly sets — anything it
doesn't set can fall through to Tailwind's reset and cause subtle layout
bugs (cursor misalignment, off gutters).

**Fix**: write an exhaustive `EditorView.theme()` covering every property
the editor's layout depends on (font, line-height, padding, gutter
background) rather than relying on any inherited value:

```typescript
import { EditorView } from '@codemirror/view'

export const jamEditorTheme = EditorView.theme({
  '&': { fontSize: '14px', fontFamily: 'ui-monospace, monospace', height: '100%' },
  '.cm-content': { padding: '8px 0', lineHeight: '1.5', fontFamily: 'inherit' },
  '.cm-gutters': { border: 'none', backgroundColor: 'transparent' },
  '.cm-scroller': { fontFamily: 'inherit' },
})
```

**Rule to follow**: never apply Tailwind utility classes to CodeMirror's
*internal* nodes (`.cm-content`, `.cm-line`, etc.) — it re-renders that DOM
and will strip hand-added classes. Tailwind classes belong only on the
wrapper `<div>` the editor mounts into.

Shadow DOM was considered for full isolation but skipped — it has known
cross-browser bugs (a stylesheet-constructor error inside iframes, and a
Firefox-specific `adoptedStyleSheets` bug), and an exhaustive theme achieves
the same isolation without that fragility.

## Deployment

Nitro's `cloudflare` preset (Workers with static Assets) builds the Nuxt app
and the Durable Object into one deployable unit. Recent versions of Wrangler
auto-detect a Nuxt project and generate `wrangler.jsonc` automatically
(entry at `.output/server/index.mjs`, assets at `.output/public`). The DO
class and its binding are added manually to that config alongside whatever
Wrangler generates.
