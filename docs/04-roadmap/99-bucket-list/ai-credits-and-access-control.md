# AI credits & access control

**The problem.** The moment `@jah` can call a model, every message a
user sends it spends money — Marco's money, whether Workers AI neurons
or Claude tokens on an API key. jaime is pre-launch: not ready to show
dev friends yet, further still from an investor demo. *"Nobody uses my
AI credits without my knowledge and consent"* is a hard requirement.

It breaks into four controls plus one enabling decision. A little of
this lands in the `@jah` roadmap's phase 1; most of it is later work
whose shape depends on where the tool goes.

---

## The enabling decision: route every model call through an AI Gateway

A Cloudflare **AI Gateway** sits in front of the model (Workers AI *or*
Claude) and gives, as configuration rather than code:

- **Per-request logging** — every call, with prompt, response, token
  counts, latency, cost.
- **Cost tracking + spend alerts** — a running total and a notification
  when it crosses a threshold.
- **Rate limiting** — requests per minute at the gateway, before the
  model is touched.
- **Caching** — identical prompts don't re-bill.

It is also provider-agnostic: switching Workers AI → Claude for quality
keeps all of the above unchanged. For a pre-launch tool where the owner
is paying, this is the single highest-leverage choice. **Do it from the
first `@jah` model call.**

---

## 1. Allowlist — *consent*

`@jah` access is **not** "has a GitHub account". It is an explicit list
Marco controls.

- **Minimum viable:** a `users.ai_access` flag (default off) plus an env
  list of GitHub logins that auto-grant on sign-in — so Marco's own
  account and a handful of seeded dev friends are always in without a
  toggle.
- **Next:** a one-route admin surface (gated to Marco's user id) to flip
  the flag per user, so adding someone doesn't need a redeploy.
- **Later, if there's a wider beta:** invite codes — Marco generates a
  code, hands it out, redeeming it grants `ai_access`. Scales to
  "sign-ups" without opening the gate.

A user without `ai_access` who `@jah`s gets a friendly "AI is invite-only
right now" reply, not silence.

---

## 2. Budget caps — *runaway protection*

Independent of the allowlist. Even an allowlisted friend — or a bug in
a loop — must not be able to run up an unbounded bill.

- **Per-user daily cap** — e.g. N `@jah` requests / 24h, server-enforced,
  counter in D1 or the room's Durable Object.
- **Global daily cap** — a hard ceiling across all users; when hit,
  `@jah` politely declines until it resets.
- Both are cheap counters. The AI Gateway's rate limiting is a second
  layer, not a replacement — it limits rate, not daily total spend.

---

## 3. Kill switch

One flag — `JAH_ENABLED=0` (env var) or a Durable-Object-stored boolean
Marco can flip from an admin route — that disables **every** AI call
instantly, for the "oh no" moment. The DO-stored version is better (no
redeploy); the env var is the fallback if the admin route itself is
broken.

---

## 4. Visibility — *knowledge*

The "without my knowledge" half. Marco wants to *see* usage, not only
gate it.

- **Per-call record:** who (user id + GitHub login), which room, model,
  prompt + response token counts, a cost estimate, timestamp.
- **Where:** a D1 table is simplest to start (`ai_usage`); Cloudflare
  **Workers Analytics Engine** is the better long-term home (cheap
  high-cardinality time series, queryable) once there's enough volume
  to want charts.
- The AI Gateway's own dashboard covers a lot of this for free — the
  D1/AE record is for jaime-specific attribution (per user, per room)
  the gateway doesn't know about.

---

## 5. Operator visibility — *who signed up*

Distinct from usage: once `add-oauth-signin` ships, people will create
accounts, and Marco has no in-app way to see them — which is exactly
who he needs to know to pick the `ai_access` allowlist.

- **Now / stopgap:** query D1 directly —
  `wrangler d1 execute PATTERNS_DB --remote --command "SELECT
  github_login, email, display_name, status, created_at FROM users
  ORDER BY created_at DESC"` (or the Cloudflare dashboard's D1 console).
  Zero code, works today.
- **Later:** a `/admin` route gated to Marco's account — a list of
  accounts (name, GitHub login, joined, `ai_access`) with a per-user
  `ai_access` toggle, and the `ai_usage` view from §4 alongside it. One
  page, three reads and one write. Sequenced **with or just before
  Phase 1**, since the allowlist is unusable without a way to see who's
  on it.
- Marco's own identity for the gate: GitHub login `MarcoAAlmeida` /
  email `marcoalmeida.dev.br@gmail.com` — hard-code the check, don't
  build roles yet.

---

## Trajectory notes

The access model's ambition tracks where the tool is going:

| Stage | What's enough |
|---|---|
| **Now** — Marco only | env allowlist + a per-user cap + logging |
| **Dev friends** — a handful, trusted | same, add their GitHub logins to the allowlist |
| **Wider beta** — sign-ups | invite codes, admin toggle, global cap tightened, spend alerts |
| **Investor demo** | must not look broke: caching on, a sane global cap, a usage view Marco can screen-share; usage attribution good enough to bill against *if* a paid tier ever appears |

A paid tier would flip the model — the *user's* credits, not Marco's —
and needs per-account budgets + a billing hook. Out of scope until it's
real, but the per-call `ai_usage` record is the seam it would attach to,
so record it cleanly from day one.

---

## What lands in the `@jah` roadmap vs. here

**Phase 1 of the `@jah` roadmap (non-negotiable):**
- Every call through an AI Gateway.
- ~~`ai_access` flag + env allowlist auto-grant~~ — done in
  `add-admin-console`; phase 1 just calls `hasAiAccess()`.
- A per-user daily cap and a global daily cap.
- A kill switch (env var is acceptable for phase 1; DO flag is better).
- A per-call `ai_usage` record in D1 — table done; phase 1 adds the
  `recordUsage()` write.

**With or just before Phase 1 — ✅ shipped as `add-admin-console`
(2026-09-04):**
- A `/admin` route (§5) — account list + `ai_access` toggle + the
  `ai_usage` view. Also landed here: the `ai_access` flag, the
  `AI_ACCESS_LOGINS` env allowlist, the `hasAiAccess()` check, and the
  `ai_usage` table (write helper is Phase 1's).

**Later, from this doc, driven by trajectory:**
- Invite codes.
- Workers Analytics Engine + a richer usage view.
- Per-tenant / per-account budgets, billing seam.
