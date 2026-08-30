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

// --- expand + copy + preview ------------------------------------------------
type AudioEngine = typeof import('~/lib/audioEngine')
let audio: AudioEngine | undefined
let audioLoad: Promise<AudioEngine> | undefined

// Load the (heavy) Strudel bundle and register the audio-unlock click
// listener as soon as the user shows intent to preview — i.e. expands a
// row. Doing it here (rather than in the Preview click handler) means
// initAudioOnFirstClick() is armed before the click that would satisfy
// it, same reasoning as the JAM room's primeAudio() call.
function preloadAudio() {
  audioLoad ??= import('~/lib/audioEngine').then((m) => {
    audio = m
    m.primeAudio()
    return m
  })
  return audioLoad
}

const expanded = ref<string | null>(null)
function toggleExpanded(id: string) {
  const opening = expanded.value !== id
  expanded.value = opening ? id : null
  if (opening) preloadAudio()
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

const copiedId = ref<string | null>(null)
async function copyCode(pattern: Pattern) {
  await navigator.clipboard.writeText(pattern.code)
  copiedId.value = pattern.id
  setTimeout(() => {
    if (copiedId.value === pattern.id) copiedId.value = null
  }, 1500)
}

const previewingId = ref<string | null>(null)
const previewLoading = ref(false)
const previewError = ref<{ id: string, message: string } | null>(null)

async function togglePreview(pattern: Pattern) {
  previewError.value = null
  if (previewingId.value === pattern.id) {
    await audio?.stopPreview()
    previewingId.value = null
    return
  }
  previewLoading.value = true
  try {
    const engine = await preloadAudio()
    await engine.stopPreview()
    const err = await engine.evaluatePreview(pattern.code)
    if (err) {
      previewError.value = { id: pattern.id, message: err }
      previewingId.value = null
    }
    else {
      previewingId.value = pattern.id
    }
  }
  catch (e) {
    previewError.value = { id: pattern.id, message: (e as Error).message }
  }
  finally {
    previewLoading.value = false
  }
}

onBeforeUnmount(() => {
  audio?.stopPreview()
})
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
              <pre class="text-muted bg-elevated overflow-x-auto rounded p-3 text-xs"><code>{{ pattern.code }}</code></pre>

              <UAlert
                v-if="previewError?.id === pattern.id"
                class="mt-3"
                color="error"
                variant="subtle"
                icon="i-lucide-alert-triangle"
                title="Pattern error"
                :description="previewError.message"
              />

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <UButton
                  label="Load into JAM"
                  icon="i-lucide-radio"
                  size="xs"
                  color="primary"
                  data-testid="load-into-jam"
                  @click="loadIntoJam(pattern)"
                />
                <UButton
                  :label="previewingId === pattern.id ? 'Stop' : 'Preview'"
                  :icon="previewingId === pattern.id ? 'i-lucide-square' : 'i-lucide-play'"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  :loading="previewLoading && previewingId !== pattern.id"
                  @click="togglePreview(pattern)"
                />
                <UButton
                  :label="copiedId === pattern.id ? 'Copied' : 'Copy code'"
                  :icon="copiedId === pattern.id ? 'i-lucide-check' : 'i-lucide-copy'"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  @click="copyCode(pattern)"
                />
                <span class="text-dimmed ml-auto text-xs">
                  Source:
                  <ULink :to="pattern.source.url" target="_blank" class="text-muted hover:text-default">
                    {{ sourceLabel(pattern) }}
                  </ULink>
                </span>
              </div>
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
