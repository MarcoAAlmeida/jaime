<script setup lang="ts">
definePageMeta({ layout: 'landing' })

useSeoMeta({
  title: 'jaime — a hub of small music tools',
  description:
    'jaime is a hub of small, browser-based music tools. Jam on shared Strudel patterns, compose together, and browse a pattern library.'
})

// Returning-visitor fast path: anyone who has already set a display
// name (JAM's per-session identity) has used a tool before — surface a
// direct link straight to the dashboard so they skip the pitch.
const { displayName } = useDisplayName()
</script>

<template>
  <UPageHero
    title="Make music together, in the browser"
    description="jaime is a hub of small, music-oriented tools. Jam on shared patterns, compose together, and dig through a library of ideas — nothing to install."
    :links="[
      { label: 'Try JAM', to: '/app/jam', icon: 'i-lucide-radio', size: 'lg' },
      { label: 'Read the docs', to: '/docs', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right', size: 'lg' }
    ]"
  >
    <ClientOnly>
      <UAlert
        v-if="displayName"
        class="mx-auto mt-4 max-w-md"
        color="neutral"
        variant="subtle"
        icon="i-lucide-arrow-right"
        :title="`Welcome back, ${displayName}`"
        :actions="[{ label: 'Go to the dashboard', to: '/app/jam', color: 'neutral' }]"
      />
    </ClientOnly>
  </UPageHero>

  <UPageSection
    id="tools"
    headline="Tools"
    title="What's in the hub"
    description="Each tool is small and does one thing. More are on the way."
  >
    <UPageGrid>
      <UPageCard
        v-for="tool in TOOLS"
        :key="tool.to"
        :title="tool.label"
        :description="tool.description"
        :icon="tool.icon"
        :to="tool.ready ? tool.to : undefined"
        :ui="{ container: 'lg:flex-col' }"
      >
        <template #footer>
          <UBadge v-if="tool.ready" color="primary" variant="subtle">Available</UBadge>
          <UBadge v-else color="neutral" variant="subtle">Coming soon</UBadge>
        </template>
      </UPageCard>
    </UPageGrid>
  </UPageSection>

  <UPageCTA
    title="Want to hear when tools land?"
    description="Join the community list. It's the only thing we'll email you about."
    :links="[
      { label: 'Join the community', to: '/signup', icon: 'i-lucide-mail' },
      { label: 'Try JAM first', to: '/app/jam', color: 'neutral', variant: 'subtle' }
    ]"
  />
</template>
