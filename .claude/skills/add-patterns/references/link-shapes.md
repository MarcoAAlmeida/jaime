# Kinds of source and how `resolve` treats them

| Source | How it resolves | Reliability | If it fails |
| --- | --- | --- | --- |
| `strudel.cc/#<base64>` | the fragment is plain base64 of the UTF-8 source — decoded offline, no request | solid | `not-base64`: the fragment isn't code; ask for another link |
| `strudel.cc/?<hash>` | a **short link holds only an id**; the code is in strudel.cc's own store. `resolve` reads the store's address and its public client key from the live site's scripts at run time, then looks the id up. The hints come from the code's `@title/@by/@license` header. | **fragile** — an undocumented backend | `short-link-unavailable`: ask the developer to paste the code; `not-found`: the id is unknown |
| raw URL (`raw.githubusercontent.com/…`, any plain-text URL) | fetched as text; the URL is its own source | solid | `http` / `not-found` |
| `github.com/<o>/<r>/blob/<branch>/<path>` | read via the raw URL; the blob URL is the source | solid | as above |
| gist (`gist.github.com/<user>/<id>`) | via the gist API; each code file is a candidate | solid | `not-found` if it has no code files |
| `github.com/<o>/<r>` or `…/tree/<branch>/<dir>` | **one tree listing**, then raw fetches (no per-file API calls, so the unauthenticated rate limit isn't a factor). Candidates are `.js/.mjs/.strudel/.str/.txt` files, minus dot-folders, `node_modules`, files over 100 KB. Source = the file's URL **on the branch** (not commit-pinned). Files in `functions/`, `lib/`, `helpers/`… are flagged `helper: true`; files that call `register()` get a note. | solid | `not-found` if no code files |
| a web page (docs, blog, README, forum) | **not scripted** — `needs-reader` | judgment | you read the page, pull out the code blocks, and pass them on with the page's URL (or a strudel.cc link if it has one) |
| a strudel.cc page without a link id (`/learn/…`) | `needs-reader` | judgment | as above |
| a local file or `-` (stdin) | read as given; you must pass `--source-url` | solid | `unsupported` if neither a URL nor a file |

Declined outright (`not-strudel`): TidalCycles (`d1 $ …`), Sonic Pi
(`live_loop`, `use_synth`), SuperCollider (`SynthDef`, `Pbind`), empty files.
This is a heuristic — say what you saw if the developer disagrees.

A candidate whose `sourceUrl` is already in the library carries `existing:
<id>`: it will be an update (with `--update`), never a duplicate.

`skipped[]` lists files that were found but not usable (not Strudel, too big,
unreadable) with reasons — always mention them.
