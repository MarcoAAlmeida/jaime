# Roadmap

One active roadmap: **`@jah` intelligence** — turn `@jah` from a
placeholder into an assistant that knows Strudel from its own
documentation, sees the script in the editor, explains code, finds library
patterns, debugs and composes. It always proposes; a human applies.
Past roadmaps and plans are in [`01-archive/`](./01-archive/).

**Start here:** [`jah-intelligence/README.md`](./jah-intelligence/README.md)
— decisions already made, open decisions, a codebase map and the ground
rules for whoever builds it. Each phase has its own brief with the
OpenSpec changes to propose, in order.

| Phase | Capability | Changes | Brief |
|---|---|---|---|
| 0 | Foundations: measure `@jah`, make its reply code ready for context | `add-jah-eval-harness`, `add-jah-retrieval-seam` | [phase-0](./jah-intelligence/phase-0-foundations.md) |
| 1 | `@jah` knows Strudel (docs from the submodule, sources cited) | `add-strudel-knowledge-corpus`, `add-knowledge-store`, `add-jah-knowledge-retrieval` | [phase-1](./jah-intelligence/phase-1-knows-strudel.md) |
| 2 | `@jah` sees your script and selection — **the explainer** | `add-jah-script-context` | [phase-2](./jah-intelligence/phase-2-sees-your-script.md) |
| 3 | `@jah` knows the patterns (code analysis, musical features, similarity) | `add-strudel-code-analysis`, `add-pattern-musical-features`, `add-pattern-similarity-search` | [phase-3](./jah-intelligence/phase-3-knows-the-patterns.md) |
| 4 | Patterns get functional descriptions | `add-pattern-functional-descriptions` | [phase-4](./jah-intelligence/phase-4-enrich-the-patterns.md) |
| 5 | `@jah` the debugger (error context, fix cards with Apply) | `add-jah-error-context`, `add-jah-fix-cards` (+ a spike) | [phase-5](./jah-intelligence/phase-5-debugger.md) |
| 6 | `@jah` the composer | `add-jah-composer` | [phase-6](./jah-intelligence/phase-6-composer.md) |

Phases 1 and 2 can overlap. The UX for sources, the selection indicator,
Apply and error surfacing is **not yet designed** — discuss with the
developer before building it. Deliberately out of scope: per-room memory
and the Cloudflare Agents SDK, LangChain, audio analysis, `@jah` editing
the document itself.

## Follow-ups

Small, known pieces of work that are not scheduled.

- **Share the session cookie with `games.jaime.stream`.** The
  `jaime_session` cookie is host-only on `jaime.stream` (no `Domain`
  attribute), so the games site never receives it. Scope it to
  `.jaime.stream` — in `setSessionCookie` and `clearSessionCookie`
  (`server/utils/auth.ts`) — so a jaime sign-in carries over. Considerations:
  existing host-only cookies stay valid until users sign in again, and
  sign-out must clear the cookie with the same `Domain`. The games side
  resolves the cookie through `POST /api/session/verify`
  (`add-session-verify-api`).
