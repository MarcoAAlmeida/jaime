<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Public marketing shell (site root + signup). Patterned after
// landing-template.nuxt.dev: UHeader / UMain / UFooter.
const items: NavigationMenuItem[] = [
  { label: 'Tools', to: '/#tools' },
  { label: 'Docs', to: '/docs' },
  { label: 'Community', to: '/signup' }
]
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <UHeader :ui="{ center: 'hidden' }">
      <template #title>
        <span class="text-highlighted text-lg font-semibold tracking-tight">jaime</span>
      </template>

      <UNavigationMenu :items="items" color="neutral" variant="link" />

      <template #right>
        <UColorModeButton />
        <UButton label="Open the dashboard" color="neutral" variant="ghost" to="/app/jam" />
        <UButton label="Try JAM" to="/app/jam" />
      </template>

      <template #body>
        <UNavigationMenu :items="items" color="neutral" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>

    <UMain class="flex-1">
      <slot />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-muted text-sm">
          jaime — a hub of small music tools. © {{ new Date().getFullYear() }}
        </p>
      </template>
      <template #right>
        <UButton
          label="Strudel"
          icon="i-lucide-external-link"
          color="neutral"
          variant="ghost"
          to="https://strudel.cc"
          target="_blank"
        />
      </template>
    </UFooter>
  </div>
</template>
