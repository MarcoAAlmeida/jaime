---
title: Behind the scenes
description: The stack, and why this project writes a spec before it writes code — with real examples of where that's paid off, and where it hasn't.
coverImage: /articles/covers/jaime-home.png
publishedAt: "2026-09-17"
authRequired: true
tags:
  - meta
  - openspec
---

# Behind the scenes

Signed-in only — partly because it's the simplest real thing to gate,
partly because build notes are more interesting to people who've
bothered to make an account.

## The stack

- **Nuxt 4** on **Cloudflare Workers** (Nitro's `cloudflare-durable`
  preset). One Worker serves the SSR app, the static assets, and the
  realtime WebSocket relay.
- **Nuxt UI v4** for the component layer.
- **Durable Objects** hold each room's live state; **D1** holds the
  durable stuff — accounts, patterns, the ASCII-art catalog, and
  (separately) `@nuxt/content`'s own database for this very page.
- **Strudel** is the live-coding language JAM and the pattern library
  speak, running entirely in the browser — no server-side audio.
- Auth is passwordless: an emailed link starts a server-side session,
  no passwords stored.

## Why write a spec before writing code

For a solo project, "write a proposal, then a design doc, then a task
list, *then* touch the code" sounds like theater — process for a team
that doesn't exist. The actual reason it's stuck around is narrower
than that: it's a forcing function against the specific failure mode
of starting to code before the shape of the thing is settled, discovering
three files in that the plan was wrong, and now having sunk cost
pulling toward finishing the wrong plan anyway. Writing the design
down first is cheap to throw away. Code you've already written isn't,
even when you know it should be thrown away.

The concrete mechanics, tracked with
[OpenSpec](https://github.com/Fission-AI/OpenSpec):

1. **`spec:`** — a proposal (what & why), capability spec deltas (what
   the system must do, as a diff against the current contract), a
   design doc (how, and what was deliberately *not* done), and a task
   list — all written and committed before any implementation code
   changes.
2. **`impl:`** — the tasks are worked through, with tests, verified
   locally and then live.
3. **archive** — the spec deltas are merged into the living
   `openspec/specs/`, and the change moves to
   `openspec/changes/archive/`.

`openspec/specs/` is always the current contract for what the system
does. `openspec/changes/archive/` is the paper trail of how it got
there — which turns out to matter more than it sounds like it should,
because six months on, "why does this work this way" is answerable by
reading a design doc instead of reconstructing intent from a diff.

## Where it's actually paid off: the ASCII overlay

The clearest recent example is the Composition Room's ASCII-art panel.
The design doc split it into three slices *on purpose*, before any code
existed:

1. Ship the overlay UI against two hand-picked fixture pieces — no
   scraping, no database, no beat sync. Just: does the panel sit in
   the right place, does the font scale sanely at both a tiny piece and
   a huge one, is the opacity right.
2. Only once that shape was approved: build the scraper, run it against
   real infrastructure (asciiart.eu, ~4,380 pieces across 26
   categories), and verify the real data actually landed correctly —
   *before* writing a single line of the code that would depend on it.
3. Only once the real data was confirmed live: wire the beat-driven
   swap logic against it.

The reason this mattered isn't abstract. If the beat-sync logic (slice
3) had been built first against fixture data, and *then* the real
14,000-request crawl had turned up some malformed rows or a slower
crawl than expected, that would have been discovered at the worst
possible point — deep inside code that already assumed clean data.
Sequencing it as three slices meant each risky assumption (does this
look right? does the scrape actually work at scale?) got retired
independently, before the next slice was allowed to depend on it. See
[Reference: asciiart.eu](/docs/ascii-art) for what that scrape actually
produced.

This page — Articles itself — went through the same split: land the
collection, routes, and home/index listing against throwaway fixture
content first, verify the plumbing end-to-end, *then* write the four
real articles (this one included) as a separate pass. Writing prose
was never gated on routing code being right, and routing code was
never at risk of being rewritten because a later editorial decision
changed the schema.

## Where it's been overkill

Not everything gets this treatment, and forcing it everywhere would be
its own mistake. A batch of landing-page polish — decluttering the
mobile header, rebranding the color identity from rust to a pine
green, swapping in a new logo and favicon set — went straight to code,
verified in the browser, no proposal or design doc. None of it changed
what the system *does*; all of it was small, immediately reversible,
and cheaper to just look at than to write a document predicting how it
would look. The spec-driven loop is worth its overhead when a decision
is expensive to reverse or when its shape genuinely isn't obvious yet
— not as a ritual applied uniformly regardless of the size of the
change.
