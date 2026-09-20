import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { getIcons } from '@iconify/utils'

const require = createRequire(import.meta.url)

// game-icons.net icons in use anywhere in jaime, by bare name (no
// `game-icons:` prefix). This one list feeds BOTH bundles below: it is
// the only thing that puts a game-icons icon into the Worker's server
// render (the collection itself is ~6.4 MB — 2.8 MB gzipped, more than
// the whole rest of the Worker — so it is never bundled whole), and it
// is added to the client bundle explicitly so an icon named only in a
// .ts file is still covered.
//
// Using a new icon takes TWO edits, both required: add its name here,
// and add its icon → author line to content/credits/game-icons.md (CC BY
// 3.0 needs per-icon attribution — see the `icon-library` spec). A name
// missing from this list renders nothing, in dev as well as production.
const GAME_ICONS_IN_USE: string[] = []

const gameIconsSubset = GAME_ICONS_IN_USE.length > 0
  ? getIcons(
      JSON.parse(readFileSync(require.resolve('@iconify-json/game-icons/icons.json'), 'utf8')),
      GAME_ICONS_IN_USE
    )
  : null

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon-96x96.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/android-icon-192x192.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-icon-180x180.png' },
        { rel: 'manifest', href: '/manifest.json' }
      ],
      meta: [
        { name: 'msapplication-TileColor', content: '#f1f4ec' },
        { name: 'msapplication-TileImage', content: '/ms-icon-144x144.png' },
        // Match the app surface (green-tinted paper light / graphite dark)
        // so a PWA launch doesn't flash white.
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#f1f4ec' },
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#191817' }
      ]
    }
  },
  // @nuxt/content MUST come after @nuxt/ui or the prose components the
  // docs shell renders won't be registered. nuxt-auth-utils is used
  // only for its `defineOAuth*EventHandler` helpers (the GitHub OAuth
  // handshake); its own session/`useUserSession` is not used — jaime's
  // D1 `sessions` table + `jaime_session` cookie stay authoritative.
  modules: ['@nuxt/ui', '@nuxt/content', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  // Bundle only the icons we actually use, into both the client JS and
  // the server render, so nothing is fetched from the Iconify API at
  // runtime (it isn't reachable from the Cloudflare Worker). `scan`
  // catches icons named literally in templates; `icons` lists the ones
  // that only appear in app/utils/tools.ts, which the scan globs miss.
  //
  // The server bundle embeds each listed collection WHOLE as a chunk in
  // the Worker (lucide: ~0.5 MB, accepted). `serverBundle: 'local'`
  // would embed every installed @iconify-json set automatically —
  // measured with game-icons installed: the Worker grew 6.5 → 12.8 MB
  // (≈ +2.8 MB gzipped) for zero icons in use — so collections are
  // listed explicitly instead, and game-icons goes in as a subset (see
  // GAME_ICONS_IN_USE above). Installing another @iconify-json set does
  // NOT bundle it until it is listed here.
  icon: {
    serverBundle: {
      collections: ['lucide', ...(gameIconsSubset ? [gameIconsSubset] : [])]
    },
    clientBundle: {
      scan: true,
      icons: ['lucide:radio', 'lucide:users', ...GAME_ICONS_IN_USE.map(name => `game-icons:${name}`)],
      includeCustomCollections: true
    },
    fallbackToApi: false
  },
  routeRules: {
    // JAM's active room and the Composition Room are both browser-only
    // (WebSocket, Web Audio, Strudel/CodeMirror) — and both transitively
    // import @kabelsalat/web via @strudel/core, whose broken "main"
    // field (see the alias below) only gets resolved correctly through
    // Vite's client bundling, not Nitro's dev-SSR vite-node runner.
    '/app/jam/room/**': { ssr: false },
    '/app/composition/**': { ssr: false },
    // JAM moved under the dashboard shell; keep older links alive.
    '/app': { redirect: '/app/jam' },
    '/room/**': { redirect: '/app/jam/room/**' }
  },
  nitro: {
    preset: 'cloudflare-durable',
    experimental: {
      websocket: true
    },
    typescript: {
      tsConfig: {
        // wrangler types' generated ambient types (DurableObjectState,
        // DurableObjectStorage, ...) aren't under server/ or shared/, so
        // Nitro's generated tsconfig doesn't pick them up by default.
        include: ['../worker-configuration.d.ts']
      }
    }
  },
  alias: {
    // @kabelsalat/web (a @strudel/core dependency) has no "exports" map,
    // so its "main" field resolves to a broken UMD build missing a static
    // SalatRepl export. Force resolution to its working ESM build instead.
    '@kabelsalat/web': fileURLToPath(new URL('./node_modules/@kabelsalat/web/dist/index.mjs', import.meta.url))
  }
})