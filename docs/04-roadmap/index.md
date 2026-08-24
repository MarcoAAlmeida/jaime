# Roadmap

The previous roadmap (Phases 1–6, building the JAM tool) is archived at
[`01-archive/20260823.md`](./01-archive/20260823.md).

## Next roadmap: jaime becomes a tools hub

jaime pivots from a single-purpose jam app to a hub for small
music-oriented tools, mini-apps, and demos. JAM (the room /
track-ownership / transport-clock tool built across the previous
roadmap) becomes the *first* tool in the hub, not the whole product —
it keeps getting improved alongside new tools being added, not frozen
in place. Guiding intent: make the site genuinely useful, not a boring
tech demo.

This is a first-draft phase breakdown synthesized from discussion —
expect it to be corrected before it's final.

## Phase 1 — Visual identity + click-through mocks

Design and UX only, no persistence or DDD work yet — deliberately
first, so screens get validated before the domain model is built
around them.

- `jaime.stream` has been registered (Cloudflare Registrar) and will
  become the production domain, replacing the `*.workers.dev` default
  — superseding the earlier "defer custom domain until user feedback"
  stance. It will also back Cloudflare Email Sending later, but that
  service isn't enabled yet — deliberately left until Phase 2+, when
  the email confirmation flow (see [user stories](../06-user-stories/index.md), Journey 1 story 5)
  is actually implemented. Pointing the deployed Worker at the new
  domain (custom domain / route config) is a task for this phase.
- Fix `design/tokens/`'s light-mode background (`--ui-bg` currently
  resolves to plain white; target is a pastel light-beige, per
  `design/assets/jaime-logo.jpg`, the reference image — filename is a
  placeholder, a real logo PNG comes later). Dark mode already uses a
  custom `graphite` neutral ramp correctly (no navy, reads as
  gray/near-black) — confirmed against the actual token files, not
  assumed.
- Real (Vue/Nuxt UI, not the React design-system export) implementations
  of three layout shells, each a genuine Nuxt layout, not composed:
  - **Landing** — [landing-template.nuxt.dev](https://landing-template.nuxt.dev/)
  - **Dashboard** (the tools shell — sidebar with Home + each tool,
    Composition Room first, then JAM) — [dashboard-template.nuxt.dev](https://dashboard-template.nuxt.dev/)
  - **Docs** (Home and each of its sections — Strudel, Hydra,
    TidalCycles, others later — full layout swap, not nested inside the
    dashboard chrome) — [docs-template.nuxt.dev](https://docs-template.nuxt.dev/)
    — likely needs `@nuxt/content` added as a new dependency
- Click-through mocks for every screen implied so far, generated from
  user stories: landing page; dashboard home; JAM (re-skinned to the new
  visual identity); Home + per-technology docs pages; community
  email-gate/signup; Pattern library browse/search; **Composition
  Room** (see Phase 6) — shared editor, presence indicator, viewer-only
  join mode, chat panel (empty/placeholder — no AI wired up yet).

## Phase 2 — Domain model + persistence foundation

- Settle the DDD model properly: **User** (durable *across sessions* —
  a real step up from today's `sessionStorage`-only display name — tied
  to the email-gated signup), **Room** (already real; gains the
  Composition Room variant in Phase 6), **Pattern** (a curated,
  independently-browsable list — not saved from a room — seeded from
  [awesome-strudel](https://github.com/terryds/awesome-strudel/tree/main)),
  **Sample** (relationship to Pattern still open: supporting data for
  patterns, or its own independently searchable entity).
- Stand up a persistence layer beyond today's per-room Durable Object
  storage, which is good at "this room's state" but not built for
  cross-room search — most likely Cloudflare D1, chosen specifically
  because **migrations and real version control on the schema** are a
  hard requirement, and D1 has first-class `wrangler d1 migrations`
  tooling for exactly that. (Vectorize remains a candidate later if
  Pattern search wants to be similarity-based rather than
  keyword/tag-based — noted as a possibility, not decided.)

## Phase 3 — Full Strudel parity in JAM

Everything normally available at [strudel.cc](https://strudel.cc/) —
sample playback, all waveforms, the full feature set — not just the
built-in-synth subset JAM has today. Unblocks curated patterns that rely
on samples, which most real-world Strudel patterns do.

## Phase 4 — Pattern (and Sample) library

Searchable, curated library backed by Phase 2's persistence layer;
browsable/searchable UI per the Phase 1 mocks; patterns invokable
directly into JAM (and later, Composition Room).

## Phase 5 — Curated content authoring (Claude-assisted)

A content phase, not an infrastructure phase: Claude helps register real
Patterns (seeded from awesome-strudel) and write the Home/docs pages for
Strudel — and eventually Hydra, TidalCycles. Needs Phase 1's docs layout
and Phase 4's Pattern storage to already exist.

## Phase 6 — Composition Room

A new Room type: a single shared CodeMirror editor that one or more
Users edit **collaboratively** (not JAM's independent-tracks model).

- Shareable link, presence indicator, and a **viewer** join mode — you
  can join a Composition Room without editing rights.
- Editors get a chat panel. Its purpose is asking an AI for coding
  help — but the AI itself is explicitly Phase 7, not this phase; the
  panel/UI can exist before the AI behind it does.
- Technical mechanism researched and confirmed: `@codemirror/collab`
  (v6.1.1, same generation as the `@codemirror/state`/`@codemirror/view`
  jaime already uses, maintained by CodeMirror's own author) handles
  client-side operational-transform reconciliation, but requires a
  **central authority** server-side (`getDocument`/`pushUpdates`/
  `pullUpdates`, an ordered changeset history + version per document) —
  a Durable Object is a natural fit for that role. This is a genuinely
  different sync mechanism from JAM's single-owner, whole-string-replace
  `pattern_update` — a second protocol living alongside the first, not a
  modification of it. Live cursor/selection visibility for other editors
  is a natural companion, not required for the core capability.

## Phase 7 — AI chat / agents

Deliberately last — built once everything above is mature, not before.
Wires an AI assistant into Composition Room's chat panel, aware of:
Strudel syntax, the curated Pattern library (Phase 4), and the current
script being edited. Any other agent-shaped feature also belongs here,
not earlier.

---

_This phase breakdown is a first draft synthesized from discussion, not
yet confirmed — revise freely._
