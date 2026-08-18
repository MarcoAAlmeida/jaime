## 1. Project scaffolding

- [ ] 1.1 `npx nuxi init` + NuxtUI module install
- [ ] 1.2 Disable SSR for the jam route
- [ ] 1.3 Confirm `wrangler dev` serves the app locally

## 2. Editor

- [ ] 2.1 Mount CodeMirror 6 in `TrackEditor.vue` via `onMounted`
- [ ] 2.2 Write exhaustive `EditorView.theme()` (font, line-height,
      padding, gutter background) per `03-architecture-frontend.md`
- [ ] 2.3 Confirm Tailwind utility classes are never applied to `.cm-*`
      internal nodes

## 3. Audio

- [ ] 3.1 Wire `@strudel/webaudio` scheduler in `lib/audioEngine.ts`
- [ ] 3.2 Single shared `AudioContext`, play/stop controls
- [ ] 3.3 Manual test: type a pattern, hear it play

## 4. Deploy loop

- [ ] 4.1 `wrangler deploy` to a real `*.workers.dev` URL
- [ ] 4.2 Confirm static assets + editor + audio work on the deployed URL,
      not just localhost
