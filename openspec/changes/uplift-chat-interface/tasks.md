## 1. Markdown renderer spike (decides the library)

- [x] 1.1 Build a throwaway harness that renders hostile/edge inputs
      through `@comark/nuxt`: raw `<script>`/`<img onerror>`, remote
      image syntax, a `javascript:` link, an `http(s)` link, single
      newlines, backticks, a fence, and Strudel like `s("bd*4 hh*8")`
      and `_pitchwheel`. Record which spec scenarios (composition-room:
      "Chat Messages Render Markdown Safely") pass and whether the
      failing ones are configurable.
- [x] 1.2 Decide: use Comark if every scenario can be met; otherwise
      use `markdown-it` (`html: false`, `breaks: true`, image/link
      renderer overrides per design decision 7). Note the composition
      route chunk-size delta for both. Record the decision in
      design.md and delete the harness.

## 2. Markdown component

- [x] 2.1 Add the chosen dependency (`npm i`), and `ChatMarkdown.vue`
      (`text` prop) wrapping it: no raw HTML, images dropped to alt
      text, links `http(s)`-only with `target="_blank"
      rel="noopener noreferrer"`, single newlines preserved, plain
      (unhighlighted) code blocks.
- [x] 2.2 Component tests for every safety scenario in the
      composition-room delta (raw HTML shown literally, no image
      request, `javascript:` not linked, links open safely, line
      breaks kept, inline code/fence formatted).

## 3. Message mapping

- [x] 3.1 `app/lib/chatMessages.ts`: pure mapping from `ChatMessage[]`
      + own `clientId` to `UChatMessages` shape (ids, parts, role/side/
      variant per design decision 1, `@jah` → assistant with
      `/jah-avatar.svg`, avatar props, `metadata` carrying name/at,
      `data-testid` for the row).
- [x] 3.2 Unit tests: own vs other vs `@jah`; stable, unique ids
      across appends; avatar fallback (initial) when no `avatarUrl`; a
      synthetic typing message appended only while `jahTyping`.

- [x] 3.3 `@jah`'s avatar: replace `public/jah-avatar.svg` in place with
      the game-icons `lion` path (from `@iconify-json/game-icons`,
      recoloured red on a round badge; attribution in the file's
      metadata). Add the `lion` row (Lorc, source URL) to
      `content/credits/game-icons.md`, and give the `@jah` avatar a
      `title` crediting artist + licence. `GAME_ICONS_IN_USE` stays
      empty (static file, not `UIcon`). Check it at avatar size (roster
      chip, chat bubble, typing bubble) in light and dark themes.

## 4. Protocol: `@jah` availability on join

- [x] 4.1 `shared/compositionProtocol.ts`: add
      `jah: 'available' | 'signed-out' | 'no-access' | 'disabled'` to
      the `welcome` server message.
- [x] 4.2 `server/routes/composition.ts`: compute it in the `join`
      handler — `disabled` first (`isJahEnabled`), then `signed-out`,
      then `no-access`, else `available` — and include it in
      `welcome`. Gating in the `chat` handler is untouched.
- [x] 4.3 `app/lib/compositionProvider.ts`: surface it (event/value)
      and default to `signed-out` until `welcome` arrives.
- [x] 4.4 Pool-workers tests (extend `test/jah-chat.test.ts`): each of
      the four values arrives in `welcome` for the right kind of
      connection (anonymous; signed-in without access; signed-in
      with access). `disabled` is not exercisable through a socket in
      this test env (`.dev.vars`' `JAH_E2E=1`) — cover its precedence
      in a unit test of the extracted decision function instead.

## 5. Chat panel

- [x] 5.1 Replace the hand-rolled log in `[id].vue` with `UChatMessages`
      inside the existing scroll container: header slot for the
      sender name (hidden on own messages), `#content` with
      `ChatMarkdown`, the synthetic typing bubble
      (`UChatShimmer`, `data-testid="jah-typing"`), no `status` prop.
      Preserve `chat-log`, `chat-message-row`, `chat-message` testids.
- [x] 5.2 Scrolling: keep scroll-to-bottom on new messages, but only
      when the reader was already near the bottom or the message is
      their own; keep the empty-state hint until the first message.
- [x] 5.3 Replace the `UInput` row with `UChatPrompt` (`autofocus`
      off, `maxrows` capped) + `UChatPromptSubmit` (always `ready`);
      keep `chat-input` / `chat-send` testids; placeholder hints
      Markdown/backticks.
- [x] 5.4 Prompt footer: the model-selector placeholder (toast
      "not implemented yet", no state) and the "to @jah" `USwitch`
      (prefix rule per design decision 5; sticky per page session;
      disabled with a reason hint derived from the `welcome.jah` value).
- [x] 5.5 Check phone width and the bottom tab bar: prompt sits above
      the bar, textarea growth can't push the log off-screen, and no
      horizontal page scroll.

## 6. Update tests and verify

- [x] 6.1 Update e2e that matched combined row text (`"Alice: hey
      room"`, `"Vic: sounds good"`, `"@jah:"`, `"Anon: @jah hello?"`)
      to match on message text and on the name only where it is shown;
      keep `toHaveCount` for peers not on the Chat tab.
- [x] 6.2 New e2e (`e2e/chat-interface.spec.ts`): Shift+Enter makes a
      new line and Enter sends; own message is set apart from another
      participant's; a `@jah` reply is styled distinctly; markdown
      renders and a hostile message (`<img onerror>`, image syntax,
      `javascript:` link) does nothing; the switch prefixes `@jah `,
      stays on, and doesn't double an existing mention; the switch is
      disabled for an anonymous visitor and enabled for an allowlisted
      user; the model selector shows the toast and changes nothing.
- [x] 6.3 Typecheck, `vitest run`, `playwright test` green
      (composition, mobile-rooms, oauth, ascii-panel, jah-chat,
      chat-interface). Rebuild before pool-workers tests that use
      `SELF.fetch`.
- [ ] 6.4 `openspec validate uplift-chat-interface --strict`.
- [ ] 6.5 Browser-verify locally at desktop and phone width; then
      `npm run deploy` and confirm on `jaime.stream`: a real `@jah`
      reply renders as the assistant with markdown, the switch works
      for an allowlisted account, and the tab still opens on Chat.
- [ ] 6.6 Sync the `composition-room` and `jah-chat` deltas; archive
      the change; update `docs/04-roadmap/index.md` if it mentions the
      chat UI.
