---
title: Why Strudel feels different to write in
description: Not the syntax — the mental model. Cycles, composition by chaining, and what changes when code is the instrument.
coverImage: /articles/covers/strudel-cc.png
publishedAt: "2026-09-14"
tags:
  - strudel
  - live-coding
---

# Why Strudel feels different to write in

The short description is easy: [Strudel](https://strudel.cc) is a
live-coding pattern language, a JavaScript port of
[TidalCycles](https://tidalcycles.org), and it's what JAM and the
Composition Room speak. That sentence tells you what it is. It doesn't
tell you why sitting down and actually writing in it feels unlike
almost anything else that makes sound on a computer. That's the part
worth slowing down for.

## Everything is a cycle, not a timeline

A DAW — Ableton, Logic, anything with a horizontal ruler across the top
— represents time as a line you scroll along. A clip sits at bar 17.
An automation curve rises between bar 32 and bar 40. The timeline is
the ground truth, and editing means placing things at positions on it.

Strudel has no line. It has a **cycle** — one loop, repeating — and a
pattern describes what happens *within* one cycle, not where something
sits on an axis of elapsed time:

```strudel
s("bd sd bd sd")
```

There is no "bar 17" in this sentence, because there's no timeline for
bar 17 to be a position on. There is only this cycle, described once,
played forever, until you change the description. That's a genuinely
different object to hold in your head: not "a recording of a decision
I made," but "a rule I'm currently running." When you edit the string
while it plays, you're not scrubbing a timeline back to fix something —
you're changing the rule the next cycle will obey. The old cycle
already happened and is gone; you were never editing it.

## Patterns compose by chaining, not by mutating

The second thing that's easy to say and important to actually feel:
every method call on a pattern returns a **new** pattern.

```strudel
s("bd sd bd sd").fast(2).rev().gain(0.8)
```

`.fast(2)` doesn't reach into `s("bd sd bd sd")` and speed it up in
place. It takes that pattern as a value and produces a different value
— one that happens to be "the first pattern, played twice as fast." `.rev()`
does the same to *that* result, and `.gain(0.8)` to the result of
that. Nothing upstream is ever touched. This is why you can freely
reorder, duplicate, or delete a link in the chain without the rest of
the expression silently changing meaning behind your back — each link
only knows about the value it received, never about how that value was
built.

Compare that to automating a filter cutoff in a DAW: you're editing a
curve that lives *on top of* a track, a second object referencing the
first by position. Move the clip, and now you have to think about
whether the automation lane should move with it. In Strudel there's no
second object to keep in sync — `.lpf(...)` isn't attached beside the
pattern, it's a new pattern *derived from* it. The composability isn't
a nice feature bolted on; it falls out of patterns being ordinary
immutable values, the same way `[1,2,3].map(x => x*2)` doesn't mutate
the original array.

## Structure is data, not a sequence of actions

Mini-notation makes this concrete in a way that's easy to undersell.
`"bd(3,8), hh*8"` isn't a script that runs top to bottom — it's a
*description* of a rhythm, and the whole engine's job is to figure out
what that description implies about a given slice of time. Ask for
half a cycle, or a cycle stretched to 3x length, or a cycle nested
inside a `<a b c>` alternation, and it just works, because "what
happens between t=0.2 and t=0.4" was always answerable from the
pattern's structure, never dependent on having "played" up to that
point first. A step sequencer or a MIDI clip has no equivalent
question to answer — it only knows what's *placed* where you put it.
This is also what makes an `.every(4, rev)` or a `.sometimesBy(0.3,
fast(2))` unremarkable to write: you're not scheduling an event, you're
adding one more transformation to a value that already knows how to
answer "what happens over any given span."

## What this actually buys you, live

Put those three things together — no timeline to scrub, no mutation to
track, structure that answers questions about any point without having
been "played" there first — and you get an editor where changing one
character can restructure the *entire* piece the next time around,
predictably, because you changed a value, not a stored state. That's
the actual appeal of live coding as a performance: not "look, code!"
but that the distance between "I have an idea" and "the room hears it"
is one edit and one keystroke, because the language was built so that
edits compose instead of accumulate.

None of this requires knowing the syntax yet — that's what
[strudel.cc/learn](https://strudel.cc/learn) and jaime's own [pattern
library](/app/patterns) are for, a catalog of real Strudel snippets
with a **Preview** button and a **Load into JAM** button on every one.
This page was about the shape of the thing before you learn to speak
it.
