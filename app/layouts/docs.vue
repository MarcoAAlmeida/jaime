<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import type { NavigationMenuItem } from '@nuxt/ui'

// Docs shell — a distinct layout with its own nav (docs-shell spec),
// but sharing the dashboard's collapsible/resizable sidebar UX so the
// two shells feel like one product.
const { data: navigation } = await useAsyncData('docs-navigation', () =>
  queryCollectionNavigation('docs')
)

// queryCollectionNavigation returns the /docs root with its pages as
// children; the sidebar wants the pages.
const sections = computed<ContentNavigationItem[]>(
  () => navigation.value?.[0]?.children ?? navigation.value ?? []
)

const items = computed<NavigationMenuItem[][]>(() => [
  sections.value.map(section => ({
    label: section.title,
    icon: section.icon ?? (section.path === '/docs' ? 'i-lucide-house' : 'i-lucide-book-text'),
    to: section.path
  })),
  [
    { label: 'Back to tools', icon: 'i-lucide-arrow-left', to: '/app/jam' }
  ]
])
</script>

<template>
  <UDashboardGroup storage-key="jaime-shell">
    <UDashboardSidebar collapsible resizable>
      <template #header>
        <NuxtLink to="/" aria-label="jaime home">
          <Logo />
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items"
          color="neutral"
          orientation="vertical"
        />
      </template>

      <template #footer="{ collapsed }">
        <UColorModeButton :class="collapsed ? '' : 'ml-auto'" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
