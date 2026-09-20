<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Public marketing shell (site root + signup). Patterned after
// landing-template.nuxt.dev: UHeader / UMain / UFooter.
const items: NavigationMenuItem[] = [
  { label: 'Features', to: '/#features' },
  { label: 'Docs', to: '/docs' },
  { label: 'Articles', to: '/articles' },
  { label: 'Community', to: '/signup' }
]
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <UHeader :ui="{ center: 'hidden' }">
      <template #title>
        <Logo />
      </template>

      <UNavigationMenu :items="items" color="neutral" variant="link" />

      <template #right>
        <UColorModeButton />
        <AuthLink />
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
          jaime — a hangout for developers. © {{ new Date().getFullYear() }}
        </p>
      </template>
      <template #right>
        <UButton
          v-for="tool in DEMOTED_TOOLS"
          :key="tool.to"
          :label="tool.label"
          :to="tool.to"
          color="neutral"
          variant="link"
          size="xs"
          class="text-muted"
        />
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
