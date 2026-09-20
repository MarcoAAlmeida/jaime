<script setup lang="ts">
import type { Pattern, PatternListResult } from '#shared/catalog'
import { nanoid } from 'nanoid'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Pattern library — jaime' })

const PAGE_SIZE = 24

const searchInput = ref('')
const q = ref('')
const activeTags = ref<string[]>([])
const page = ref(1)

// Debounce the text box → the query param the fetch keys off.
let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    q.value = value.trim()
    page.value = 1
  }, 250)
})
watch(activeTags, () => { page.value = 1 }, { deep: true })

const { data: tagData } = await useFetch<{ tags: string[] }>('/api/patterns/tags')
const allTags = computed(() => tagData.value?.tags ?? [])

const { data, status, error } = await useFetch<PatternListResult>('/api/patterns', {
  query: computed(() => ({
    tag: activeTags.value,
    q: q.value || undefined,
    page: page.value,
    limit: PAGE_SIZE,
  })),
})

const patterns = computed<Pattern[]>(() => data.value?.patterns ?? [])
const total = computed(() => data.value?.total ?? 0)

function toggleTag(tag: string) {
  activeTags.value = activeTags.value.includes(tag)
    ? activeTags.value.filter(t => t !== tag)
    : [...activeTags.value, tag]
}

function clearFilters() {
  searchInput.value = ''
  q.value = ''
  activeTags.value = []
  page.value = 1
}

// --- expand + preview ------------------------------------------------------
// Preview state is the shared composable (also used by the chat's @jah
// code cards). No options here: a library preview plays until stopped.
const preview = usePatternPreview()

const expanded = ref<string | null>(null)
function toggleExpanded(id: string) {
  const opening = expanded.value !== id
  expanded.value = opening ? id : null
  if (opening) preview.preload()
}

function sourceLabel(pattern: Pattern): string {
  if (pattern.source.author) return pattern.source.author
  try {
    return new URL(pattern.source.url).hostname.replace(/^www\./, '')
  }
  catch {
    return 'source'
  }
}

// Open a fresh JAM room with this pattern on the loader's track A. The
// room page reads ?load and seeds track A once (see the room [id].vue).
function loadIntoJam(pattern: Pattern) {
  navigateTo(`/app/jam/room/${nanoid(10)}?load=${encodeURIComponent(pattern.id)}`)
}

// Open a fresh Composition Room seeded with this pattern's code
// instead of the generic starter document (simplify-room-entry).
function loadIntoCompositionRoom(pattern: Pattern) {
  navigateTo(`/app/composition/${nanoid(10)}?load=${encodeURIComponent(pattern.id)}`)
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="searchInput"
            icon="i-lucide-search"
            placeholder="Search patterns…"
            class="w-64"
          />
        </template>
        <template #right>
          <UButton
            v-if="activeTags.length || q"
            label="Clear"
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="clearFilters"
          />
        </template>
      </UDashboardToolbar>
      <UDashboardToolbar v-if="allTags.length">
        <template #default>
          <div class="flex flex-wrap gap-1 py-1">
            <UButton
              v-for="tag in allTags"
              :key="tag"
              :label="tag"
              size="xs"
              :color="activeTags.includes(tag) ? 'primary' : 'neutral'"
              :variant="activeTags.includes(tag) ? 'solid' : 'outline'"
              @click="toggleTag(tag)"
            />
          </div>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div v-if="status === 'pending' && !patterns.length" class="text-muted py-12 text-center text-sm">
        Loading patterns…
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-triangle"
        title="Couldn't load the pattern library"
        :description="error.statusMessage ?? 'Please try again.'"
      />

      <p v-else-if="!patterns.length" class="text-muted py-12 text-center text-sm">
        No patterns match that filter.
      </p>

      <template v-else>
        <p class="text-muted mb-4 text-xs">
          {{ total }} pattern{{ total === 1 ? '' : 's' }}
        </p>

        <div class="flex flex-col gap-2">
          <UCard
            v-for="pattern in patterns"
            :key="pattern.id"
            :ui="{ body: 'p-0 sm:p-0' }"
          >
            <button
              type="button"
              class="hover:bg-elevated/50 flex w-full items-center gap-3 p-4 text-left transition-colors"
              @click="toggleExpanded(pattern.id)"
            >
              <UIcon
                name="i-lucide-chevron-right"
                class="text-dimmed size-4 shrink-0 transition-transform"
                :class="expanded === pattern.id ? 'rotate-90' : ''"
              />
              <span class="font-medium">{{ pattern.title }}</span>
              <div class="ml-auto flex flex-wrap justify-end gap-1">
                <UBadge
                  v-for="tag in pattern.tags"
                  :key="tag"
                  :label="tag"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                />
              </div>
            </button>

            <div v-if="expanded === pattern.id" class="border-default border-t p-4">
              <StrudelCard
                :code="pattern.code"
                :previewing="preview.previewingId.value === pattern.id"
                :preview-loading="preview.loading.value"
                :error="preview.error.value?.id === pattern.id ? preview.error.value.message : null"
                @preview="preview.toggle(pattern.id, pattern.code)"
              >
                <template #actions>
                  <UButton
                    label="Load into JAM"
                    icon="i-lucide-radio"
                    size="xs"
                    color="primary"
                    data-testid="load-into-jam"
                    @click="loadIntoJam(pattern)"
                  />
                  <UButton
                    label="Load into Composition Room"
                    icon="i-lucide-users"
                    size="xs"
                    color="primary"
                    variant="outline"
                    data-testid="load-into-composition"
                    @click="loadIntoCompositionRoom(pattern)"
                  />
                </template>
                <template #aside>
                  <span class="text-dimmed ml-auto text-xs">
                    Source:
                    <ULink :to="pattern.source.url" target="_blank" class="text-muted hover:text-default">
                      {{ sourceLabel(pattern) }}
                    </ULink>
                  </span>
                </template>
              </StrudelCard>
            </div>
          </UCard>
        </div>

        <div v-if="total > PAGE_SIZE" class="mt-6 flex justify-center">
          <UPagination
            v-model:page="page"
            :total="total"
            :items-per-page="PAGE_SIZE"
          />
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
