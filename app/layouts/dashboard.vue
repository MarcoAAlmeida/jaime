<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Tools shell — persistent collapsible/resizable sidebar. "Home" links
// into the docs shell, which is its own layout (layouts/docs.vue) —
// selecting it swaps the sidebar contents (tools → doc sections), not
// the chrome.
const route = useRoute()

const items = computed<NavigationMenuItem[][]>(() => [
  [
    {
      label: 'Home',
      icon: 'i-lucide-house',
      to: '/docs'
    },
    ...TOOLS.map(tool => ({
      label: tool.label,
      icon: tool.icon,
      to: tool.to,
      active: route.path === tool.to || route.path.startsWith(`${tool.to}/`),
      badge: tool.ready ? undefined : 'Soon'
    })),
    {
      label: 'Patterns',
      icon: 'i-lucide-library',
      to: '/app/patterns',
      active: route.path === '/app/patterns'
    }
  ],
  [
    {
      label: 'Community',
      icon: 'i-lucide-mail',
      to: '/signup'
    }
  ]
])
</script>

<template>
  <UDashboardGroup storage-key="jaime-shell">
    <UDashboardSidebar collapsible resizable>
      <template #header>
        <NuxtLink to="/" class="text-highlighted text-lg font-semibold tracking-tight">
          jaime
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
