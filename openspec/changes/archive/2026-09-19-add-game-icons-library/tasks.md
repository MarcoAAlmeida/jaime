## 1. Dependency

- [x] 1.1 Add `@iconify-json/game-icons` to `package.json`
      (devDependency, like lucide; also `@iconify/utils` — see 2.1)

## 2. Bundling config

- [x] 2.1 Extend `nuxt.config.ts`'s `icon` block so `game-icons` reaches
      the server render. Deviation from the original plan, found by
      measurement: `serverBundle: 'local'` embeds every installed
      collection whole (Worker 6.5 → 12.8 MB), so `serverBundle` now
      lists `collections: ['lucide', <game-icons subset>]` explicitly,
      the subset built with `getIcons()` from `GAME_ICONS_IN_USE`
      (see design.md)
- [x] 2.2 Extend the `clientBundle` (`scan` + explicit `icons` list) to
      cover `game-icons:*` names — the explicit list is generated from
      the same `GAME_ICONS_IN_USE`
- [x] 2.3 Confirm `fallbackToApi: false` still holds — no icon render should trigger a network request

## 3. Attribution record

- [x] 3.1 Create the attribution record file (e.g. `content/credits/game-icons.md`), starting empty, documenting its purpose and the icon → author entry format
- [x] 3.2 Note in the record (or nearby) that new entries are added whenever a `game-icons:*` icon is first used anywhere in jaime, per the `icon-library` spec

## 4. Verification

- [x] 4.1 Render one `game-icons:*` icon (server and client) in a throwaway/dev context to confirm it displays with no network request to Iconify's API
- [x] 4.2 Confirm the existing lucide icons still render unchanged
- [x] 4.3 Remove the throwaway usage before merging, since this change introduces no real consumer yet — leaving the attribution record's icon → author format as the only lasting artifact of the verification step
