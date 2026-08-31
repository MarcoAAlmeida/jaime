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

## Phase 1 — Visual identity + click-through mocks — ✅ shipped 2026-08-30

Design and UX only, deliberately first so screens got validated before
the domain model. Delivered: rust/beige/graphite visual identity wired
into @nuxt/ui; three layout shells (landing; a shared
collapsible/resizable sidebar for the dashboard + docs); JAM re-routed
under `/app/jam`; `jaime.stream` as the production domain (workers.dev
301s to it); `@nuxt/content` docs shell; click-through mocks for the
Pattern library, Composition Room, and community signup. Live at
`https://jaime.stream`.

Full spec and task detail:
[`openspec/changes/archive/2026-08-30-add-tools-hub-visual-identity/`](../../openspec/changes/archive/2026-08-30-add-tools-hub-visual-identity/).
One deviation: `@nuxt/content` requires a Cloudflare D1 database, so
Phase 1 introduced one as a read-only content store (not the domain
persistence layer — that's still Phase 2).

## Phase 2 — Domain model + persistence foundation — ✅ shipped 2026-08-31

- The DDD model is fully worked out in
  [`docs/05-domain-model/index.md`](../05-domain-model/index.md)
  (decisions 1–10). **Pattern**, **User**, **AuthToken**, and
  **Session** are shipped entities in the Catalog context; **Sample**
  is modeled but not yet built (patterns lean on Strudel's `dirt-samples`
  bank for now, no `Sample` table).
- **User** is durable across sessions *and devices* now, a real step up
  from the `sessionStorage`-only display name — passwordless email
  sign-in, persistent cookie sessions, sign out, account deletion, and
  a docs page gated to signed-in users.
  ([`archive/2026-08-31-add-user-auth/`](../../openspec/changes/archive/2026-08-31-add-user-auth/))
- Persistence layer: a `jaime-patterns` Cloudflare D1 database with
  version-controlled schema via `wrangler d1 migrations` — chosen
  because migrations on the schema were a hard requirement. Holds
  patterns and, since `add-user-auth`, users / auth tokens / sessions.
  ([`archive/2026-08-30-add-pattern-library/`](../../openspec/changes/archive/2026-08-30-add-pattern-library/))
- (Vectorize remains a later candidate if Pattern search wants to be
  similarity-based rather than keyword/tag-based — not decided.)

## Phase 3 — Full Strudel parity in JAM — ✅ shipped 2026-08-30

Sample playback (`dirt-samples`) and `@strudel/tonal` (`.scale()` /
`.voicing()`) now load in JAM's engine alongside the built-in synths,
so curated sample- and tonal-based patterns play. Delivered together
with Phase 4's "load into JAM" as
[`archive/2026-08-30-add-jam-pattern-loading/`](../../openspec/changes/archive/2026-08-30-add-jam-pattern-loading/)
(plus the `@strudel/tonal` fix, commit `5a5e59f`). Any remaining
strudel.cc features not yet wired are minor follow-ups, not a phase.

## Phase 4 — Pattern (and Sample) library — ✅ shipped 2026-08-30

Curated, searchable/browsable Pattern library backed by the Phase 2 D1
layer, per the Phase 1 mocks; server-side tag filter + text search,
in-row Preview, and a "Load into JAM" that opens a fresh room with the
pattern seeded into track A.
([`archive/2026-08-30-add-pattern-library/`](../../openspec/changes/archive/2026-08-30-add-pattern-library/),
[`archive/2026-08-30-add-jam-pattern-loading/`](../../openspec/changes/archive/2026-08-30-add-jam-pattern-loading/)).
Still open: a first-class **Sample** entity/library, and invoking
patterns into the Composition Room (Phase 6-gated).

## Phase 5 — Curated content authoring (Claude-assisted) — next

A content phase, not an infrastructure phase: Claude helps register real
Patterns (seeded from awesome-strudel) and write the Home/docs pages for
Strudel — and eventually Hydra, TidalCycles. Needs Phase 1's docs layout
and Phase 4's Pattern storage to already exist — both now do. No
OpenSpec change yet.

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
