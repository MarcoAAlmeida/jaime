# Roadmap

No active roadmap. Past roadmaps and plans are in
[`01-archive/`](./01-archive/).

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
