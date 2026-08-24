# User stories

Written in Connextra format (*As a `<role>`, I want `<goal>`, so that
`<benefit>`*), grouped by journey stage. `<role>` names a **role a User
holds**, not a separate entity — see the note at the end.

This file grows incrementally as the next roadmap's stories are worked
out — it isn't meant to be complete on first write.

## Journeys at a glance

Ordered as a visitor would actually encounter them: landing page
first, then the tools shell, then each tool, then the features that
support the tools, then the flows underneath everything else.

1. **Landing / discovery** — a visitor's first look at jaime: what it
   is, and the path in.
2. **Dashboard navigation** — the tools shell: sidebar to Home and
   each tool.
3. **Composition Room** — the first tool: a shared, collaboratively-
   edited script.
4. **JAM session** — the second tool. **Already implemented and
   shipped**, unlike every other journey here.
5. **Pattern library** — browsing and loading curated Strudel patterns
   into a tool.
6. **Home / docs content** — deep-dive documentation on Strudel,
   Hydra, TidalCycles.
7. **Community signup / authentication** — email capture and the
   confirmation flow that unlocks gated features.
8. **Content authoring** (internal, Claude-assisted) — how curated
   Patterns and docs pages actually get written.

## Journey 1: Landing / discovery

Not built yet — the current `/` is only the JAM create/join screen
(Journey 4's entry point). This is the real marketing landing page
(Phase 1), patterned after landing-template.nuxt.dev.

1. As a visitor, I want to immediately understand what jaime is (a hub
   of small music-oriented tools), so that I know within a few seconds
   whether it's relevant to me.
2. As a visitor, I want to see the tools available — **Composition
   Room** and **JAM**, listed in that order, and others as they launch
   — so that I can pick one that interests me.
3. As a visitor, I want one obvious path to start using a tool (e.g.
   "Try JAM"), so that I can get into it without hunting for the right
   link.
4. As a visitor, I want to reach the docs (Strudel/Hydra/TidalCycles
   deep-dives) directly from the landing page, so that I can learn
   before committing to a tool.
5. As a visitor, I want to sign up for the newsletter with just an
   email, so that I can stay updated or unlock gated features later —
   without that being required to try a tool first.
   - **Addendum**: gated features (AI chat) require a **confirmed**
     email, not merely a provided one — a real confirmation flow: the
     user receives a link, clicking it is what actually promotes them
     to an authenticated User. Providing an email alone isn't enough.
   - **Resolved**: `jaime.stream` has been registered (Cloudflare
     Registrar) and will serve as both the production domain (replacing
     the `*.workers.dev` default) and the domain behind Cloudflare
     Email Sending once the confirmation flow is actually built —
     superseding the earlier "no custom domain until we have user
     feedback" deferral. Cloudflare Email Sending itself is not enabled
     yet; that's deliberately left until Phase 2+, when the
     confirmation flow is implemented.
6. As a returning visitor, I want a fast path back into the
   dashboard/tools, so that I don't have to re-read the marketing
   content every time.

## Journey 2: Dashboard navigation

Not built yet — introduces the dashboard shell (Phase 1), patterned
after dashboard-template.nuxt.dev. This is the chrome tools live
inside; entering a tool from the sidebar keeps the dashboard chrome,
while Home fully swaps to the docs layout instead (Journey 6).

7. As a User, I want a persistent sidebar listing Home and every
   available tool — **Composition Room** and **JAM**, in that order,
   plus more as they launch — so that I can move between tools without
   returning to the landing page.
   - Order matches Journey 1 story 2's tool order, applied here for
     consistency — flag if that's wrong for the dashboard specifically.
8. As a User, I want the sidebar to show which tool I'm currently
   using, so that I always know where I am in the app.
9. As a User, I want clicking a tool in the sidebar to switch directly
   into it without a full page reload of the shell, so that moving
   between tools feels instant.
10. As a User, I want clicking "Home" in the sidebar to leave the
    dashboard chrome entirely and land on the docs-style Home section,
    so that reading deep-dives feels like a docs site, not a tool
    wrapped in dashboard chrome.
11. As a User reading docs, I want an obvious way back into the
    dashboard/tools, so that I'm not stranded in the docs layout.

## Journey 3: Composition Room

Not built yet — a new Room type (Phase 6), and the first tool listed
in the dashboard (Journey 2). A single shared CodeMirror editor edited
**collaboratively**, using `@codemirror/collab` with a
Durable-Object-backed central authority — a different sync mechanism
from JAM's independent-tracks model.

12. As a visitor, I want to create a new Composition Room, so that I
    can start a shared script with others.
13. As a visitor, I want to join a Composition Room via a shareable
    link, so that I can collaborate with whoever created it.
14. As a participant, I want to join as a **viewer**, without editing
    rights, so that I can watch a session without risking changes.
15. As an editor, I want my keystrokes to merge live with other
    editors' changes instead of overwriting them, so that true
    simultaneous collaborative editing works (not last-write-wins).
16. As an editor, I want to see who else is actively editing, so that
    I know who I'm collaborating with in real time.
17. As an editor, I want to see other editors' live cursor/selection,
    so that I can avoid colliding with what someone else is doing right
    now. *(companion to core editing, not required for it — per
    design.md.)*
18. As an editor, I want a chat panel next to the editor, so that I
    have a place to ask for coding help. The panel/UI exists in this
    phase even though the AI behind it doesn't arrive until Phase 7,
    deliberately last on the roadmap.
19. As a viewer, I want the editor to be strictly read-only for me, so
    that I can't accidentally change someone else's shared script.

## Journey 4: JAM session

**Already implemented and shipped** — covers everything built across
the archived roadmap (Phases 1–6): dynamic rooms, display names, track
ownership, live Strudel pattern editing and playback, room-wide tempo,
presence, and Durable-Object-backed persistence across restarts. The
second tool listed in the dashboard (Journey 2).

20. As a visitor, I want to create a new room with one click, so that
    I can start jamming immediately without setup.
21. As a visitor, I want to join an existing room by pasting a link or
    typing a code, so that I can join a friend's session.
22. As a new participant, I want to set a display name before entering
    a room, so that others can recognize me instead of an anonymous ID.
23. As a returning participant (same browser tab), I want my display
    name to carry over into the next room I join, so that I don't
    re-enter it every time.
24. As a participant, I want to be told clearly that I need to
    interact with the page before audio starts, so that I understand
    why I'm not hearing anything yet.
25. As a participant, I want to claim an open track, so that I can
    write and control my own part.
26. As a track owner, I want to release my track, so that someone else
    can use it.
27. As a participant who doesn't own a track, I want its editor to be
    read-only, so that I can't accidentally interfere with someone
    else's work.
28. As a track owner, I want to edit my track's Strudel code live, so
    that I can shape my part of the jam.
29. As a track owner, I want to play or stop my track, so that I
    control when my part is heard.
30. As a participant, I want to hear every playing track in the room,
    not just my own, so that the jam sounds like a real collaborative
    mix.
31. As a track owner, I want editing my track while it's playing to
    stop it automatically, so that I never hear audio that no longer
    matches what's on screen.
32. As a participant, I want to mute a track locally, so that I can
    adjust what I personally hear without affecting anyone else.
33. As a participant, I want to see the room's current tempo, so that
    I know what BPM everyone's playing at.
34. As a participant, I want to change the room's tempo, so that the
    whole room can shift together.
35. As a participant, I want to see who else is in the room by name,
    so that I know who I'm jamming with.
36. As a participant, I want to see who owns each track by name, so
    that I know who to coordinate with.
37. As a participant, I want to copy an invite link for the current
    room, so that I can easily bring someone else in.
38. As a participant, I want the room's state (claimed tracks, code,
    tempo) to survive a server restart, so that a quiet period doesn't
    wipe out everyone's work.
39. As a participant, I want the presence list to always reflect who's
    actually connected right now, so that it never shows someone who
    already left.

## Journey 5: Pattern library

Not built yet — needs Phase 2's persistence layer and Phase 4's
library build; seeded from a curated list from
[awesome-strudel](https://github.com/terryds/awesome-strudel/tree/main).

40. As a User, I want to browse a curated list of Strudel patterns, so
    that I can find inspiration or a starting point instead of writing
    from a blank editor.
41. As a User, I want to search/filter patterns (by tag, technique,
    etc.), so that I can find something even without knowing the exact
    vocabulary for it.
42. As a User, I want to preview what a pattern sounds like before
    committing to it, so that I don't have to load it into a tool just
    to check.
43. As a User, I want to load a chosen pattern directly into JAM (onto
    my claimed track) or into a Composition Room's editor, so that I
    can start from it rather than retyping code.
44. As a User, I want each pattern to credit its original source
    (awesome-strudel / author), so that attribution is preserved.

## Journey 6: Home / docs content

Not built yet — the Home section fully swaps to a docs layout
(docs-template.nuxt.dev), reached via the dashboard sidebar's Home
link (Journey 2, story 10). Covers Strudel first; Hydra and
TidalCycles follow once written (Phase 5).

45. As a User, I want a Home section organized like a docs site (nav
    tree, one page per topic), so that I can browse deep-dives the way
    I'd browse any technical documentation.
46. As a User, I want a dedicated section covering Strudel syntax and
    concepts beyond what a tool's UI teaches inline, so that I can
    actually learn the language, not just use it.
47. As a User, I want to search the docs content, so that I can jump
    straight to the topic I need instead of browsing the nav tree.
48. As a User reading a docs page, I want links to related Patterns in
    the library, so that I can see real examples instead of just
    prose explanations.
49. As a User, I want Hydra and TidalCycles sections to exist alongside
    Strudel once written, so that the docs eventually cover every
    technology jaime's tools touch, not just one.

## Journey 7: Community signup / authentication

Not built yet — email capture plus a real confirmation-link flow.
Depends on `jaime.stream` backing Cloudflare Email Sending (deferred
to Phase 2+, see Journey 1 story 5 and the roadmap's Phase 1 domain
note).

50. As a visitor, I want to provide my email to sign up for the
    newsletter/community, so that I can stay updated on jaime.
51. As a signed-up visitor, I want to receive a confirmation email with
    a link, so that I can prove I actually own the address I gave.
52. As a visitor who clicked the confirmation link, I want to be
    promoted to an Authenticated User, so that I can access gated
    features (AI chat).
53. As a visitor who hasn't confirmed yet, I want a gated feature to
    clearly explain why it's locked and how to unlock it, so that I
    understand what's blocking me instead of hitting a dead end.
54. As an Authenticated User, I want my confirmed status to persist
    across sessions and devices (not just this browser tab), so that I
    don't have to reconfirm every time — needs the durable User entity
    from Phase 2, a real step up from today's `sessionStorage`-only
    identity.
55. As a subscribed User, I want an easy way to unsubscribe, so that
    I'm not stuck receiving emails I no longer want.

## Journey 8: Content authoring (Claude-assisted)

Not built yet — Phase 5, a content phase, not an infrastructure phase.
The role here is jaime's maintainer working *with* Claude, not an
end-user visitor — an internal journey, included because it's still a
concrete workflow the roadmap depends on.

56. As jaime's maintainer, I want Claude's help registering curated
    Patterns from awesome-strudel into the Pattern library, so that
    seeding the library doesn't require doing it entirely by hand.
57. As jaime's maintainer, I want Claude's help drafting docs pages for
    Strudel (and later Hydra/TidalCycles), so that the Home/docs
    section has real, accurate content instead of placeholders.
58. As jaime's maintainer, I want to review and edit Claude-drafted
    Patterns and docs before they go live, so that curated content
    stays accurate and reflects my voice.
59. As jaime's maintainer, I want registered Patterns to link back to
    their awesome-strudel source from the moment they're authored, so
    that attribution (story 44) is correct from day one, not
    retrofitted.

## Roles vs. entities

Every role above (`participant`, `track owner`, and future ones like
`viewer`, `editor` in a Composition Room) is a role the single **User**
entity holds in a given context — not a separate entity, not a separate
account.

**User** itself has two tiers:
- **Anonymous** — today's session-scoped display name, no email. Enough
  for every baseline capability: creating/joining JAM and Composition
  rooms, claiming tracks, editing patterns.
- **Authenticated** — a **confirmed** email (clicked a confirmation
  link, not merely provided one), tied to the newsletter-style community
  signup. Required specifically for AI chat — not required for anything
  baseline. Sending that confirmation link needs Cloudflare Email
  Sending, which needs a verified domain — `jaime.stream` was
  registered and will serve as both the production domain and the
  email-sending domain — see Journey 1, story 5.
