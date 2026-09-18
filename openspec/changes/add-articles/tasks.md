## 1. Articles collection + schema

- [x] 1.1 `content.config.ts` — add an `articles` collection (`type:
      'page'`, `source: 'articles/*.md'`) with schema: `authRequired:
      z.boolean().optional()` (same contract as `docs`), `coverImage:
      z.string()` (required — every teaser needs an image), `tags:
      z.array(z.string()).optional()`, `publishedAt: z.string()`
      (ISO date, required, drives sort order).
- [x] 1.2 Throwaway test articles (`content/articles/_test.md` and
      `_test-locked.md`, the latter `authRequired: true`) to build
      routes/UI/auth-gate against before any real content exists;
      delete them once real articles land (task 6.6).

## 2. Routes

- [x] 2.1 `app/pages/articles/[...slug].vue` — mirrors
      `app/pages/docs/[...slug].vue`'s auth-gate pattern exactly
      (strip body server-side for a signed-out visitor on an
      `authRequired` article; locked-state UI with a sign-in CTA).
      Uses the `landing` layout, not `docs` (no sidebar nav tree).
- [x] 2.2 `app/pages/articles/index.vue` — full list, every article as
      a card (title, description, `coverImage`), sorted by
      `publishedAt` descending, auth-required ones shown locked (per
      the `articles` spec) rather than omitted.
- [x] 2.3 `e2e/articles.spec.ts` (matches the existing docs precedent,
      which is also e2e-only, not vitest — see `e2e/auth.spec.ts`'s
      `/docs/behind-the-scenes` coverage): an `authRequired` article's
      body is absent from the response for a signed-out request, present
      for a signed-in one (mirrors the existing `docs` coverage for the
      same contract). Also covers the home/index link-parity contract
      (task 3).

## 3. Home page section

- [x] 3.1 `app/pages/index.vue` — new `UPageSection`/`UPageGrid` block
      (same visual pattern as the existing `#tools` section) listing
      article teasers, linking each into `/articles/<slug>` and the
      whole section into `/articles`.
- [x] 3.2 Locked articles show a lock affordance in the teaser too
      (consistent with the index).

## 4. Docs-shell updates

- [x] 4.1 `content/docs/1.index.md` — replace the "starting with
      Strudel" name-check with ASCII Art (design.md decision).
- [x] 4.2 Docs-shell nav tree: confirm ASCII Art appears once
      `content/docs/2.ascii-art.md` exists (task 6.3) — no code change
      needed, the nav tree is data-driven from the collection.

## 5. Retire the old Strudel Reference pages

- [x] 5.1 Deleted `content/docs/2.strudel.md`,
      `content/docs/2.strudel/1.mini-notation.md`, `2.sounds.md`,
      `3.effects.md`, `4.in-jam.md`, and the now-empty
      `content/docs/2.strudel/` directory.
- [x] 5.2 `e2e/docs.spec.ts` — rewritten around the ASCII Art doc (the
      only remaining nav entry besides the index).
- [x] 5.3 `e2e/auth.spec.ts` — retargeted the gated-page test from
      `/docs/behind-the-scenes` to `/articles/behind-the-scenes`
      (testid `article-locked`, not `doc-locked`).

## 6. Write the four articles

Each brief below is the durable spec for that article's content —
written down so the plan survives independent of any one session. Take
real screenshots (saved under `public/` or referenced via the
`assets` capability once published), don't stand in placeholder text.

- [x] 6.1 `content/articles/strudel.md` — **richer Explanation**.
      Replaces the current terse `2.strudel.md` landing blurb. Angle:
      not "what is Strudel" (that's a one-liner) but *why* a
      live-coding pattern language feels the way it does to write in —
      the cycle-as-unit mental model, why patterns compose by chaining
      rather than mutating, what's genuinely different from writing a
      DAW timeline. Should make someone who's never live-coded
      understand the appeal, not just the syntax (syntax is gone —
      that content is deleted, not moved here).
- [x] 6.2 `content/articles/behind-the-scenes.md` — **enhanced
      Explanation**, `authRequired: true` (unchanged gate). Builds on
      the current stack/OpenSpec-loop content; angle: make the
      spec-driven loop itself the interesting part — why write specs
      before code at all for a solo/small project, what it's actually
      bought this project (the `add-ascii-overlay` slices are a real,
      recent example to draw from), where it's been overkill.
- [x] 6.3 `content/docs/2.ascii-art.md` — **rich Reference**, lives in
      Docs, not Articles. Angle: factual/lookup material about
      asciiart.eu as jaime's data source — the site's category
      structure, the `data-id`/`data-width`/`data-height` card format
      the scraper reads, the attribution convention the site asks for
      and how jaime honors it (the per-piece link in the panel). This
      is the one page in this change that should read like Reference,
      not a story — save the narrative for 6.1/6.2/6.4.
- [x] 6.4 `content/articles/animation-libraries.md` — **rich
      Explanation, with a real screenshot of each library's own demo
      site**. Content already researched in this project: the top-10
      popularity ranking (Animate.css, Anime.js, Motion, Lottie, React
      Spring, AOS, Aceternity UI, GSAP, Three.js, Remotion) plus the
      GSAP-alternatives discussion (SplitText/ScrambleText/Text
      plugin) and the conclusion reached — a character-scramble effect
      doesn't need any of them, hand-rolled is the right call for that
      specific job. The angle is that conclusion, not the ranking
      table alone: "most popular" and "right tool for this job" are
      different questions, shown with a concrete example.
- [x] 6.5 `content/articles/diataxis.md` — **rich Explanation**. Angle:
      why jaime splits Docs/Reference from Articles/Explanation at all
      — walk through the Diátaxis framework's four types, then the
      actual before/after audit done in this project (every existing
      Strudel sub-page was Reference, only one thin gated page was
      Explanation, zero Tutorial/How-to) as the concrete case study
      that motivated this change. Cite diataxis.fr.
- [x] 6.6 Deleted `content/articles/_test.md` / `_test-locked.md`
      (task 1.2) and `content/docs/2.strudel.md` (superseded by 6.1).

## 7. Verify + ship

- [x] 7.1 `nuxt typecheck`, `vitest run` green (114/114).
- [x] 7.2 `npm run test:e2e` — full suite: 58/59 passing; the one
      failure (`oauth.spec.ts`'s avatar/room test) reproduces
      identically on a clean checkout with none of this change's
      files present — confirmed pre-existing/environmental, not a
      regression from this change.
- [x] 7.3 `openspec validate add-articles --strict` — passes.
- [ ] 7.4 `npm run deploy`; manually verify on `jaime.stream`: home
      page teasers, `/articles` index, each article page, the
      `behind-the-scenes` lock for a signed-out visit, `/docs` still
      reachable with only `ascii-art` in its nav.
- [ ] 7.5 Sync the `articles`, `landing-page`, and `docs-shell` deltas;
      archive the change.
