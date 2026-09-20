# jaime — a hangout for developers

## What this is

A browser-based app for multiple people to hang out and chat, built for
developers. The main room is the Composition Room: a chat with an AI
participant, `@jah`, plus panels — a shared live-coding editor for
[Strudel](https://strudel.cc) patterns, and an ASCII art panel synced to
the music. More panels are planned.

## Why this shape

- **No audio is streamed between clients.** Strudel patterns are just
  text. Each browser evaluates its own audio locally via Web Audio, so
  only code and timing cross the network — small, fast, and free of
  audio-sync problems.
- **One authority per room.** Each room is a single Durable Object that
  holds the shared Yjs document, presence and chat; editors connect to it
  over WebSockets. There is no peer-to-peer merging.
- **AI is a room participant, not a feature bolted on.** `@jah` is
  addressed in chat, runs server-side, and every model call goes through
  a Cloudflare AI Gateway so cost and usage stay visible and capped.
- **Low friction to join.** Anyone can enter a room with a display name;
  signing in (email link or GitHub) unlocks `@jah` for allowlisted
  accounts.

## Who it's for

Developers who want a place to hang out, chat and make things together —
including the ones who make music with code.

## Tech stack summary

| Layer | Choice |
|---|---|
| Frontend framework | Vue 3 + Nuxt 4 (SSR off for the rooms) |
| UI components | Nuxt UI 4 |
| Editor | CodeMirror 6 + Yjs (`y-codemirror.next`) |
| Audio | Strudel (`@strudel/webaudio`), one shared `AudioContext` |
| Realtime backend | Cloudflare Durable Objects, Hibernatable WebSockets |
| Data | Cloudflare D1 (content and domain data) |
| AI | Workers AI through an AI Gateway |
| Hosting and CI | Cloudflare Workers, Workers Builds |
| Repo | https://github.com/MarcoAAlmeida/jaime |

Background: [`02-architecture-backend`](../02-architecture-backend/index.md)
and [`03-architecture-frontend`](../03-architecture-frontend/index.md).
