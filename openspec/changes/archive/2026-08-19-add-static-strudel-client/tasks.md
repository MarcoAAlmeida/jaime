## 1. Project scaffolding

- [x] 1.1 `npx nuxi init` + NuxtUI module install
- [x] 1.2 Disable SSR for the jam route
- [x] 1.3 Confirm `wrangler dev` serves the app locally

## 2. Editor

- [x] 2.1 Mount CodeMirror 6 in `TrackEditor.vue` via `onMounted`
- [x] 2.2 Exhaustive `.cm-*` theming (background, foreground, gutters,
      caret, selection) — via `@strudel/codemirror`'s bundled
      `strudelTheme`, not a hand-written `EditorView.theme()` (see
      design.md)
- [x] 2.3 Confirm Tailwind utility classes are never applied to `.cm-*`
      internal nodes

## 3. Audio

- [x] 3.1 Wire `@strudel/webaudio` scheduler in `app/lib/audioEngine.ts`
- [x] 3.2 Single shared `AudioContext`, play/stop controls (Ctrl-Enter /
      Ctrl-. keybindings, already wired via `initEditor()` in task 2.1)
- [x] 3.3 Manual test: type a pattern, hear it play — verified via full
      browser console capture showing `[eval] code updated` →
      `[cyclist] start` (not just `AudioContext.state`, which stayed
      `"running"` even while two real bugs silently prevented any sound
      — see design.md Risks: `primeAudio()`, missing `@strudel/mini`
      evalScope, missing `registerSynthSounds()`); an invalid pattern
      surfaces an error via `UAlert` without breaking playback of the
      next valid pattern

## 4. Deploy loop

- [x] 4.1 `wrangler deploy` to a real `*.workers.dev` URL —
      https://jaime.marcoalmeida-dev-br.workers.dev
- [x] 4.2 Confirm static assets + editor + audio work on the deployed URL,
      not just localhost — re-ran the same console-capture verification
      (task 3.3) against the live URL: `[eval] code updated` →
      `[cyclist] start`, and the invalid-pattern/recovery scenario, both
      passing identically to local. First pass only tested `/jam`
      directly and missed that the bare deployed URL (what a visitor
      actually lands on) 404'd — caught by the user, fixed with a
      `/` → `/jam` redirect, re-verified against the exact reported URL
      (see design.md Risks)
