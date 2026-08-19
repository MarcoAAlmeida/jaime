import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  routeRules: {
    '/': { redirect: '/jam' },
    '/jam': { ssr: false }
  },
  nitro: {
    preset: 'cloudflare-durable',
    experimental: {
      websocket: true
    }
  },
  alias: {
    // @kabelsalat/web (a @strudel/core dependency) has no "exports" map,
    // so its "main" field resolves to a broken UMD build missing a static
    // SalatRepl export. Force resolution to its working ESM build instead.
    '@kabelsalat/web': fileURLToPath(new URL('./node_modules/@kabelsalat/web/dist/index.mjs', import.meta.url))
  }
})