<script setup lang="ts">
import { nanoid } from 'nanoid'

definePageMeta({ layout: 'dashboard' })

useSeoMeta({ title: 'JAM — jaime' })

const joinInput = ref('')

function createRoom() {
  navigateTo(`/app/jam/room/${nanoid(10)}`)
}

// Accepts either a bare room code or a pasted invite link — a link
// click and a typed code should land in the same place.
function extractRoomId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/room\/([^/]+)/)
    return match ? match[1]! : null
  }
  catch {
    return trimmed
  }
}

function joinRoom() {
  const id = extractRoomId(joinInput.value)
  if (id) {
    navigateTo(`/app/jam/room/${id}`)
  }
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
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-sm flex-col gap-6 py-10">
        <div class="border-primary/25 bg-primary/5 rounded-lg border p-4">
          <h2 class="mb-1 font-medium">
            Start a new jam
          </h2>
          <p class="text-muted mb-3 text-sm">
            Generates a room and takes you straight in.
          </p>
          <UButton data-testid="create-room-button" @click="createRoom">
            Create a room
          </UButton>
        </div>

        <div class="border-default rounded-lg border p-4">
          <h2 class="mb-1 font-medium">
            Join with a link or code
          </h2>
          <p class="text-muted mb-3 text-sm">
            Paste an invite link, or type the code someone gave you.
          </p>
          <div class="flex gap-2">
            <UInput
              v-model="joinInput"
              data-testid="join-code-input"
              placeholder="Room link or code"
              class="flex-1"
              @keyup.enter="joinRoom"
            />
            <UButton
              data-testid="join-room-button"
              color="neutral"
              variant="outline"
              @click="joinRoom"
            >
              Join
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
