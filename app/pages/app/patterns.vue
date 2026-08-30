<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

useSeoMeta({ title: 'Pattern library — jaime' })

// Static mock data — no backend, no real search. The curated library
// is Phase 4, backed by the Phase 2 persistence layer.
interface MockPattern {
  title: string
  author: string
  code: string
  tags: string[]
}

const patterns: MockPattern[] = [
  {
    title: 'Four on the floor',
    author: 'jaime',
    code: 's("bd*4, [~ hh]*2, ~ sd")',
    tags: ['drums', 'house', 'beginner']
  },
  {
    title: 'Amen chop',
    author: 'jaime',
    code: 's("amen").chop(8).speed("1 2 -1 1").room(0.3)',
    tags: ['breaks', 'samples', 'intermediate']
  },
  {
    title: 'Acid line',
    author: 'jaime',
    code: 'note("c2 eb2 g2 c3").s("sawtooth").lpf(sine.range(200, 1800).slow(4)).resonance(18)',
    tags: ['bass', 'acid', '303']
  },
  {
    title: 'Ambient pad',
    author: 'jaime',
    code: 'note("<c4 g4 a4 f4>").s("triangle").attack(1).release(3).room(0.8).gain(0.5)',
    tags: ['pad', 'ambient', 'chords']
  },
  {
    title: 'Polymeter bells',
    author: 'jaime',
    code: 'note("c5 e5 g5 b5 d6").s("sine").slow(3).every(4, rev)',
    tags: ['melody', 'polymeter', 'generative']
  },
  {
    title: 'Euclidean toms',
    author: 'jaime',
    code: 's("tom(3,8), tom:2(5,8,2)").gain(0.9)',
    tags: ['drums', 'euclidean', 'intermediate']
  }
]

const query = ref('')
const activeTag = ref<string | null>(null)

const allTags = [...new Set(patterns.flatMap(p => p.tags))].sort()

// Mock-only client-side filtering so the screen feels alive — the real
// search is Phase 4.
const filtered = computed(() =>
  patterns.filter((p) => {
    const matchesQuery
      = !query.value
      || `${p.title} ${p.code} ${p.tags.join(' ')}`.toLowerCase().includes(query.value.toLowerCase())
    const matchesTag = !activeTag.value || p.tags.includes(activeTag.value)
    return matchesQuery && matchesTag
  })
)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UBadge color="neutral" variant="subtle">Pattern library · mock (Phase 4)</UBadge>
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="query"
            icon="i-lucide-search"
            placeholder="Filter patterns…"
            class="w-64"
          />
        </template>
        <template #right>
          <UButton
            v-for="tag in allTags"
            :key="tag"
            :label="tag"
            size="xs"
            :color="activeTag === tag ? 'primary' : 'neutral'"
            :variant="activeTag === tag ? 'solid' : 'outline'"
            @click="activeTag = activeTag === tag ? null : tag"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <UAlert
        class="mb-4"
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="This is a preview"
        description="The pattern library isn't wired up yet. These are hardcoded examples — browsing and search land in a later phase."
      />

      <UPageGrid>
        <UCard v-for="pattern in filtered" :key="pattern.title">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ pattern.title }}</span>
              <span class="text-muted text-xs">{{ pattern.author }}</span>
            </div>
          </template>

          <pre class="text-muted overflow-x-auto rounded bg-elevated p-3 text-xs"><code>{{ pattern.code }}</code></pre>

          <template #footer>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="tag in pattern.tags"
                :key="tag"
                :label="tag"
                color="neutral"
                variant="subtle"
                size="xs"
              />
            </div>
          </template>
        </UCard>
      </UPageGrid>

      <p v-if="!filtered.length" class="text-muted py-8 text-center text-sm">
        No example patterns match that filter.
      </p>
    </template>
  </UDashboardPanel>
</template>
