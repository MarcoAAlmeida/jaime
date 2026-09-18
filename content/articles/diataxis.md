---
title: Why Docs and Articles are two different things here
description: The Diátaxis framework's four documentation types, and the audit of jaime's own content that motivated splitting Reference from Explanation.
coverImage: /articles/covers/diataxis.png
publishedAt: "2026-09-16"
tags:
  - meta
  - documentation
---

# Why Docs and Articles are two different things here

jaime has two separate content sections that could, on the surface,
look redundant: [Docs](/docs) and [Articles](/articles). They're not a
top section and a "blog" bolted on beside it — they exist because they
serve genuinely different needs, and mixing them was making the Docs
section worse at the one job it actually has. The reasoning comes from
[Diátaxis](https://diataxis.fr), a framework for documentation
authoring, and the honest audit of this project's own content once
that framework was applied to it.

## The four types

Diátaxis's core claim is that all documentation answers one of four
distinct needs, and that trying to serve more than one need on the
same page makes it worse at both:

- **Tutorials** — learning-oriented. A beginner, followed step by
  step, ends up having *done* something and built confidence, even if
  they don't yet understand why it worked.
- **How-to guides** — goal-oriented. Someone with a specific job in
  mind ("how do I do X") gets a direct path to doing it, with no
  detour into background theory.
- **Reference** — information-oriented. Factual, structured,
  consulted while working, not read start to finish — a table, a
  schema, a list of fields. Its job is to be correct and findable, not
  to persuade or explain.
- **Explanation** — understanding-oriented. Discursive, makes
  connections, answers "why does it work this way," and is read for
  understanding, not while mid-task.

Diátaxis arranges these on two axes: whether the content serves
**action** (doing something right now) or **cognition** (building a
mental model), and whether it's for **acquisition** (learning
something new) or **application** (using something you already know).
Tutorials sit at action + acquisition. How-to guides sit at action +
application. Reference sits at cognition + application. Explanation
sits at cognition + acquisition. The claim isn't that these are
arbitrary categories — it's that a document trying to serve two
quadrants at once (a "reference" page that keeps stopping to explain
*why*, say) ends up serving neither reader well.

## What the audit found

Before this change, jaime's Docs section had five real pages: an
index, and four Strudel sub-pages — mini-notation, sounds, effects,
and "Strudel in jaime." Run each one through the four quadrants above
and the result was stark: **every one of them was Reference.** Lookup
tables of mini-notation operators. Lists of which samples and synth
voices exist. Tables of effect parameters. A rundown of what jaime's
Strudel engine does and doesn't support. Useful, correct, and entirely
information-oriented — exactly what Reference should be.

The one exception was `behind-the-scenes.md` — a page about the
project's own stack and its spec-driven workflow, which is squarely
Explanation (understanding *why*, not looking something up while
working). It was also thin, and gated behind sign-in, so it was easy
to overlook as "the one page that doesn't quite fit the pattern of the
rest of Docs."

Zero pages were Tutorial. Zero were How-to guide. That's not
necessarily wrong for a young project — a Tutorial you haven't
written yet is better than a bad one you have — but it meant Docs had
quietly become a single-purpose Reference section wearing a
general-purpose "Docs" label, with one Explanation page stranded
inside it purely because there was nowhere else for it to go.

## What changed

Rather than let Explanation content keep accumulating inside a section
whose real job is Reference, jaime now has two sections instead of
one:

- **[Docs](/docs)** stays Reference, and only Reference — the kind of
  page you consult mid-session, like [the ASCII Art
  page](/docs/ascii-art) documenting asciiart.eu's card format and
  jaime's own schema for it.
- **[Articles](/articles)** is the new home for Explanation — pages
  meant to be read for understanding, not consulted while working,
  like this one, or [why Strudel feels different to write
  in](/articles/strudel).

The four original Strudel Reference sub-pages didn't move into
Articles — mini-notation syntax and a list of effect parameters are
Reference by nature, and forcing them into an Explanation-shaped page
would just recreate the original mixing problem in reverse. They were
retired outright once their genuinely explanatory ideas — *why* Strudel
feels different to work in, not *what* its methods are called — had a
proper home to move to.

Tutorial and How-to remain an identified, unfilled gap — noted here
rather than pretended away, because Diátaxis's real value isn't
picking one type and being done; it's being honest about which
quadrants you actually have content for.
