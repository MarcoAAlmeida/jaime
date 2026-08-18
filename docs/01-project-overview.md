# jaime — collaborative live-coding jam sessions

## What this is

A browser-based app for multiple people to jam together using [Strudel](https://strudel.cc)
pattern code, in real time, from different browsers. Think of it as a shared
jam room: each person owns one instrument/track, types Strudel patterns into
their own editor, and hears everyone's tracks mixed together, all locked to
the same tempo.

## Why this shape

- **No audio is streamed between clients.** Strudel patterns are just text.
  Each browser evaluates its own audio locally via Web Audio. Only pattern
  code and timing information cross the network — small, fast, and it avoids
  WebRTC-style audio sync problems entirely.
- **No AI music generation in scope (for now).** Earlier exploration looked
  at hosting models like MusicGen or Stable Audio Open, but Cloudflare has no
  native GPU hosting for arbitrary models, and it's not needed for the core
  jam-session experience. This may return as a later phase (e.g. "suggest a
  bassline"), but it's explicitly out of scope for the MVP.
- **Track ownership instead of collaborative text editing.** Rather than
  building operational-transform/CRDT machinery to merge concurrent edits to
  shared text, each track (drums, bass, lead, ...) has exactly one owner at a
  time. No merge conflicts are possible, and it mirrors how a real jam works
  — everyone plays their own instrument.

## Who it's for

People with some live-coding or music-basics familiarity (not necessarily
professional musicians) who want to jam with Strudel patterns together over
the internet, casually, without needing a DAW or audio-streaming setup.

## Non-goals (MVP)

- Full AI-assisted composition or generation
- Recording/exporting finished tracks (may come later)
- User accounts / persistent identity beyond a session display name
- Mobile-first design (desktop browser first)

## Tech stack summary

| Layer | Choice |
|---|---|
| Frontend framework | Vue 3 + Nuxt (SSR disabled for the jam room) |
| UI components | NuxtUI |
| Pattern editor | CodeMirror 6 (`@strudel/codemirror`) |
| Audio | Strudel (`@strudel/webaudio`), one shared `AudioContext` |
| Realtime backend | Cloudflare Durable Objects, Hibernatable WebSockets |
| Hosting | Cloudflare Workers (Nitro `cloudflare` preset, Wrangler) |
| Repo | https://github.com/MarcoAAlmeida/jaime |

See `02-architecture-backend.md`, `03-architecture-frontend.md`, and
`04-roadmap.md` for details.
