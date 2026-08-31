import { fileURLToPath } from 'node:url'

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
        { name: 'msapplication-TileColor', content: '#f5f0e5' },
        { name: 'msapplication-TileImage', content: '/ms-icon-144x144.png' },
        // Match the app surface (beige light / graphite dark) so a PWA
        // launch doesn't flash white.
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#f5f0e5' },
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#191817' }
      ]
    }
  },
  // @nuxt/content MUST come after @nuxt/ui or the prose components the
  // docs shell renders won't be registered.
  modules: ['@nuxt/ui', '@nuxt/content'],
  css: ['~/assets/css/main.css'],
  // Bundle only the icons we actually use, into both the client JS and
  // the server render, so nothing is fetched from the Iconify API at
  // runtime (it isn't reachable from the Cloudflare Worker). `scan`
  // catches icons named literally in templates; `icons` lists the ones
  // that only appear in app/utils/tools.ts, which the scan globs miss.
  // NOT `serverBundle: { collections: ['lucide'] }` — that inlines the
  // whole ~300KB lucide set into a server chunk.
  icon: {
    serverBundle: 'local',
    clientBundle: {
      scan: true,
      icons: ['lucide:radio', 'lucide:users'],
      includeCustomCollections: true
    },
    fallbackToApi: false
  },
  routeRules: {
    // JAM's active room is browser-only (WebSocket, Web Audio, Strudel).
    '/app/jam/room/**': { ssr: false },
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