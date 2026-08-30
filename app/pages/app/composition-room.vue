<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

useSeoMeta({ title: 'Composition Room — jaime' })

// Everything here is mock. Real collaborative editing (@codemirror/collab
// against a Durable Object authority), presence, and the AI chat are
// Phase 6 / Phase 7.
type Mode = 'editor' | 'viewer'
const mode = ref<Mode>('editor')

const mockPresence = [
  { name: 'You', role: 'editor' as const },
  { name: 'Ada', role: 'editor' as const },
  { name: 'Lin', role: 'viewer' as const }
]

const sampleDoc = `// shared composition — everyone edits this one document
stack(
  s("bd*4"),
  note("c3 eb3 g3").s("sawtooth").lpf(800),
).slow(2)
`
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-1.5" data-testid="presence-indicator">
            <UAvatarGroup :max="3" size="xs">
              <UAvatar
                v-for="person in mockPresence"
                :key="person.name"
                :alt="person.name"
              />
            </UAvatarGroup>
            <span class="text-muted text-xs">{{ mockPresence.length }} here</span>
          </div>
          <UBadge color="neutral" variant="subtle">Composition Room · mock (Phase 6)</UBadge>
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #left>
          <UFieldGroup>
            <UButton
              label="Editor"
              icon="i-lucide-pencil"
              size="xs"
              :color="mode === 'editor' ? 'primary' : 'neutral'"
              :variant="mode === 'editor' ? 'solid' : 'outline'"
              data-testid="mode-editor"
              @click="mode = 'editor'"
            />
            <UButton
              label="Viewer"
              icon="i-lucide-eye"
              size="xs"
              :color="mode === 'viewer' ? 'primary' : 'neutral'"
              :variant="mode === 'viewer' ? 'solid' : 'outline'"
              data-testid="mode-viewer"
              @click="mode = 'viewer'"
            />
          </UFieldGroup>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="grid h-full gap-4 lg:grid-cols-[1fr_20rem]">
        <div class="flex min-h-0 flex-col gap-2">
          <UAlert
            color="neutral"
            variant="subtle"
            icon="i-lucide-info"
            title="Placeholder editor"
            :description="mode === 'viewer'
              ? 'You joined as a viewer — in the real Composition Room this document would be read-only for you.'
              : 'The real editor is one shared CodeMirror doc that everyone edits together. This is a static stand-in.'"
          />
          <div
            class="border-default bg-elevated relative min-h-0 flex-1 overflow-auto rounded-lg border"
            data-testid="mock-editor"
          >
            <pre class="text-muted p-4 text-sm"><code>{{ sampleDoc }}</code></pre>
            <UBadge
              v-if="mode === 'viewer'"
              class="absolute right-3 top-3"
              color="neutral"
              variant="solid"
              icon="i-lucide-lock"
              label="Read only"
            />
          </div>
        </div>

        <div class="border-default flex min-h-0 flex-col rounded-lg border" data-testid="chat-panel">
          <div class="border-default flex items-center gap-2 border-b p-3">
            <UIcon name="i-lucide-message-square" class="size-4" />
            <span class="text-sm font-medium">Chat</span>
          </div>
          <div class="flex flex-1 flex-col items-center justify-center gap-1 p-4 text-center">
            <p class="text-muted text-sm">No messages yet.</p>
            <p class="text-dimmed text-xs">
              This panel will host an AI coding assistant — wired up in a later phase.
            </p>
          </div>
          <div class="border-default border-t p-3">
            <UInput placeholder="Ask for help…" disabled class="w-full" />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
