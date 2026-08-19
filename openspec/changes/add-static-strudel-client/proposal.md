## Why

jaime is pre-Phase-1 — no code has been written yet. Before any realtime
collaboration (Durable Objects, WebSockets, track ownership) can be built,
the core single-user stack — Nuxt shell, CodeMirror editor, Strudel audio
playback, Cloudflare Workers deploy — needs to work end-to-end. Proving
this now, with zero collaborative complexity, de-risks the Nitro
`cloudflare` preset and Wrangler deploy loop before Durable Object state
enters the picture in Phase 2.

## What Changes

- Add a Nuxt 3 app shell with SSR disabled for the jam room route
- Add one CodeMirror 6 editor instance bound to `@strudel/codemirror`
- Add local Strudel playback via `@strudel/webaudio`, backed by a single
  shared `AudioContext`
- Add static asset hosting on Cloudflare Workers via the Nitro `cloudflare`
  preset, with a real `wrangler deploy` to a `*.workers.dev` URL (not just
  local `wrangler dev`)
- Stub `useJamSession()` now with local-only state, so its shape doesn't
  change when Phase 2 (`add-room-relay`) wires it to a real WebSocket

Out of scope for this change: any WebSocket/Durable Object code, multiple
tracks or track ownership, persistence, and the room concept — this is a
single global editor for one user.

## Capabilities

### New Capabilities
- `frontend-editor`: pattern editing (CodeMirror 6), local Strudel
  playback via Web Audio, and static deployment to Cloudflare Workers

### Modified Capabilities
(none — this is the first change, no existing specs yet)

## Impact

- New files: `nuxt.config.ts`, `app/pages/jam.vue`,
  `app/components/TrackEditor.vue`, `app/composables/useJamSession.ts`,
  `app/lib/audioEngine.ts`, `app/assets/css/main.css`,
  `app/types/strudel-codemirror.d.ts`, `app/types/strudel.d.ts`,
  `wrangler.jsonc`
- New dependencies: Nuxt 4, `@nuxt/ui`, `@strudel/codemirror`,
  `@strudel/core`, `@strudel/mini`, `@strudel/transpiler`,
  `@strudel/webaudio`, `wrangler` — no separate `jamEditorTheme.ts`;
  `@strudel/codemirror`'s bundled theme covers that (see design.md)
- New deploy target: a real `*.workers.dev` URL via `wrangler deploy`
- No backend/Durable Object impact yet — this change is entirely frontend
  and deploy-config
- `nuxt.config.ts` aliases `@kabelsalat/web` to work around an upstream
  packaging bug in a `@strudel/core` transitive dependency (see design.md
  Risks) — worth rechecking on future `@strudel/*` upgrades
