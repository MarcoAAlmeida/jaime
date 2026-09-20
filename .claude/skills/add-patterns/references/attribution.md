# Attribution

The library credits every pattern's source wherever its code is shown:
`source_url` (required) and `source_author` (optional, one string). Your job
is to fill the author in well — and to **ask when it is not obvious**.

**Licence is not a gate.** Don't refuse, delay or lecture over it. If the code
carries a `@license` header it stays in the code (fidelity); attribution is
given by recording the source.

## Where authors come from (in order of trust)

1. `@by Name <url>` in the header — the strudel.cc convention (the `<url>` is
   dropped; `resolve` does that in `hints.author`).
2. A byline on the page, or the gist/repository owner.
3. A `// script @by name` style line.
4. Nothing → leave blank rather than guess.

## When to ask

Ask the developer (don't pick) when:

- the header names an artist but the repository owner clearly wrote the
  script — **script author vs. the artist of the piece it transcribes**;
- several names appear;
- the name looks like a handle that could be either a person or a band;
- the same source shows different authors across files (a repository with
  mixed conventions — ask once for the rule, then apply it).

Offer options, for example:

1. **The script author** — e.g. the repository owner (`source_author: eefano`).
2. **The original artist** — the name in the header (`source_author: Cardiacs`).
3. **Both** — `script by <A>, after <B>`.
4. **Leave it blank**, and rely on the source URL.

Use whatever the developer chooses; for a batch, ask once and apply it to all
items with the same shape, calling out any that differ.

## Tags are not for authors (by default)

The library renders **every distinct tag as a filter chip**, and search matches
title and tags only. Many authors would bury the genre and theme tags, so
authors go in `source_author`, not `tags`, unless the developer explicitly asks
otherwise. (Searching by author would be a small library change, not part of
this skill.)
