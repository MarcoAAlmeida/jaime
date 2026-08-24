# Domain-driven design

Captures the domain model (entities, value objects, aggregates, bounded
contexts) for the next roadmap. Like [user stories](../06-user-stories/index.md),
this file grows incrementally as the model is worked out — it isn't
meant to be complete on first write.

## Refresher

- **Entity** — has identity that persists through change (a `Room` is
  still "that room" after its tempo changes).
- **Value Object** — no identity, defined entirely by its attributes,
  interchangeable with an equal one (a BPM number, an email address, a
  confirmation token).
- **Aggregate** — a cluster of entities/value objects treated as one
  *transactional* consistency unit: "what must be consistent together,
  right now," not just "things that are related."
- **Aggregate Root** — the one entity in an aggregate reachable from
  outside it; everything else inside is only ever reached through it,
  and invariants are enforced at the root.
- **Bounded Context** — a boundary where a model and its vocabulary
  stay consistent. The same word can mean different things in
  different contexts, and that's fine as long as each context is
  internally coherent.
- **Domain Event** — something that happened, worth naming
  (`TrackClaimed`, `EmailConfirmed`) — useful for precision even
  without full event sourcing.

## Current shipped model (grounded in code, not just intent)

From `shared/tracks.ts` and `shared/roomProtocol.ts`:

```
Room (aggregate root)
├─ tracks: Record<TrackName, TrackState>   // TrackState = { owner, code, isPlaying }
├─ bpm, cycleStartTimestamp
└─ presence: PresenceEntry[]               // NOT persisted, connection-scoped
```

- **Room** is the aggregate root — loaded, mutated, and persisted as a
  whole (Phase 5's whole-room-snapshot writes).
- **Track** is an entity, not its own aggregate — no identity or
  lifecycle outside a Room. `owner` today is a bare connection ID, not
  a User reference.
- **Presence** isn't persisted and isn't really part of the durable
  domain model — runtime/session state, deliberately outside the
  aggregate model rather than forced into it.
- **User** doesn't exist as a domain entity yet — today it's a bare
  connection ID plus a `sessionStorage` display name.
- **Pattern** and **Sample** exist only as roadmap intent, no code yet.

## Decisions

1. **JAM Room and Composition Room are two distinct aggregate types**,
   not one `Room` aggregate with a mode flag. Their internal shape
   diverges too much — per-track ownership (JAM) vs. a single shared
   collaboratively-edited document with changeset history (Composition)
   — to share a consistency boundary. They share a `Room` *concept* at
   the bounded-context level (creatable, joinable, has presence, has a
   shareable link), not a single struct.
2. **Composition Room's script likely needs its own nested entity**
   (a `Document`/`Script`-shaped entity holding the `@codemirror/collab`
   changeset history + version) inside the Composition Room aggregate,
   separate from presence and chat. Leaning yes, not fully pinned down
   — revisit when Composition Room's design gets detailed (Phase 6).
3. **The email confirmation token is a value object on User**, not a
   separate entity with its own lifecycle. Simpler boundary; revisit
   only if resend/expiry logic turns out to need independent identity.
4. **Sample is a distinct entity/aggregate**, not data embedded in
   Pattern. Patterns reference Samples by ID rather than owning them —
   motivated by Phase 3's full sample playback needing a sample bank
   that outlives any single curated pattern.
5. **Two bounded contexts**, mapping directly onto the two persistence
   layers already planned rather than being abstract:
   - **Realtime/Session context** — JAM Room, Composition Room (+ its
     Document entity), Track, Presence. Ephemeral or per-Durable-Object,
     matches today's DO storage model.
   - **Catalog context** — User, Pattern, Sample. Durable, cross-room,
     D1-backed per Phase 2.

6. **User aggregate** (Catalog context, D1-backed):

   ```
   User (aggregate root)
   ├─ id: UserId
   ├─ email: Email                          (value object)
   ├─ displayName: string
   ├─ status: 'pending' | 'confirmed'
   ├─ confirmationToken: ConfirmationToken   (value object — { token, expiresAt }, present only while pending)
   └─ createdAt: Date
   ```

   - **Anonymous has zero persistence** — it isn't a `User` row at all,
     just the absence of one. No stable ID across sessions, not even a
     client-generated one. Exactly what's shipped today: a session-
     scoped display name, ephemeral connection ID.
   - Tier falls out of row existence: no row = Anonymous; row with
     `status: 'confirmed'` = Authenticated. `'pending'` is the
     in-between state between Journey 7 stories 51 and 52 — not a named
     tier, just a `status` value nothing else references.
   - `displayName` is a real attribute on `User`, not just a UI
     convenience: once someone confirms, their account's `displayName`
     **overrides** whatever session-scoped name they'd set before —
     signing up promotes the name from ephemeral to durable, replacing
     it rather than merging.

7. **Pattern aggregate** (Catalog context, D1-backed):

   ```
   Pattern (aggregate root)
   ├─ id: PatternId
   ├─ title: string
   ├─ code: string                    (the Strudel snippet itself)
   ├─ tags: string[]                  (freeform, not a fixed taxonomy — supports Journey 5 story 41 search/filter)
   ├─ source: Attribution             (value object — { url, author? }, Journey 5 story 44)
   ├─ sampleIds: SampleId[]           (references, not embedded — decision 4)
   └─ createdAt: Date
   ```

   - Preview playback (Journey 5 story 42) needs no extra persistence —
     it's just running `code` client-side, same as any other pattern.
   - No `curatedBy`/maintainer field — Journey 8's content-authoring
     workflow is a Claude-assisted process, not a modeled domain
     relationship.

8. **Sample aggregate** (Catalog context, D1-backed):

   ```
   Sample (aggregate root)
   ├─ id: SampleId
   ├─ name: string
   ├─ audioUrl: string    (external URL — not jaime-hosted, at least at first)
   ├─ tags: string[]
   ├─ source: Attribution (value object, same shape as Pattern's)
   └─ createdAt: Date
   ```

   - Not self-hosted initially: `audioUrl` references an existing
     external sample bank rather than files uploaded into R2. Zero
     storage/upload pipeline for now; revisit self-hosting (R2) later
     if external reliability becomes a problem.

9. **JAM Room aggregate** (Realtime/Session context,
   Durable-Object-backed) — formalizing what's already shipped:

   ```
   JamRoom (aggregate root)
   ├─ id: RoomId
   ├─ tracks: Record<TrackName, Track>    (child entities, fixed set — not independently created/deleted)
   │   Track: { name: TrackName, owner: ConnectionId | null, code: string, isPlaying: boolean }
   ├─ bpm: number
   ├─ cycleStartTimestamp: number
   └─ presence: PresenceEntry[]           (excluded from persistence — see below)
   ```

   - **Persisted** (Phase 5, DO storage, survives restart): `tracks`,
     `bpm`, `cycleStartTimestamp`.
   - **Not persisted**: `presence` — connection-scoped, rebuilt from
     whoever's actually connected right now.
   - **Resolved: `Track.owner` stays a bare `ConnectionId`, not a
     `UserId` reference.** Claiming a track is a baseline capability
     that must work without signing up (Journey 1 story 5), and
     Anonymous has zero persistence (decision 6) — most owners will
     never have a durable `User` row to reference at all. Making
     `owner` a `UserId` would only work for the minority who've
     confirmed an email, and would need a fallback for everyone else
     anyway. Keeping it a connection-scoped identifier is what's
     already shipped, and it keeps the Realtime and Catalog contexts
     loosely coupled rather than forcing a cross-context FK for a field
     that's fundamentally session-scoped. Display-name resolution
     already works this way today (presence, not ownership, carries the
     name) and doesn't need to change.

10. **Composition Room aggregate** (Realtime/Session context,
    Durable-Object-backed):

    ```
    CompositionRoom (aggregate root)
    ├─ id: RoomId
    ├─ document: Document                    (nested entity — decision 2)
    │   Document: { version: number, changes: ChangeSet[] }   // @codemirror/collab central-authority shape
    ├─ presence: PresenceEntry[]             (ephemeral, not persisted)
    │   PresenceEntry: { clientId, name, role: 'editor' | 'viewer' }
    └─ chat: ChatMessage[]                   (ephemeral, not persisted)
    ```

    - **Persisted** (Phase 5-style DO storage, survives restart):
      `document` only — the shared script and its changeset history.
    - **Not persisted**: `presence` and `chat` — both ephemeral,
      rebuilt/cleared on restart, consistent with JAM's presence.
    - **Role assignment is self-declared, one link.** A single
      shareable link; the joiner picks editor or viewer themselves —
      no server-enforced access control, no separate edit-link vs.
      view-link. Mirrors JAM's existing trust model (anyone connected
      can claim any open track, no auth) rather than introducing a new
      access-control mechanism for just this Room type.
    - **Chat has no persistence**, even once Phase 7 wires in AI —
      it's a live, in-session thing; history is gone after a restart or
      once everyone leaves. Revisit only if Phase 7 specifically needs
      cross-session chat context.
    - Live cursor/selection, if built, rides on `PresenceEntry` as an
      ephemeral field — never persisted, consistent with the
      "companion, not core" framing in decision 2.

## Open

Catalog and Realtime contexts are both fully modeled now (decisions
1–10). Nothing outstanding — next step is likely turning this into an
`/opsx:propose` change once you're ready to move from design to
implementation.
