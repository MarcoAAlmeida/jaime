<script setup lang="ts">
import { nanoid } from 'nanoid'

const joinInput = ref('')

function createRoom() {
  navigateTo(`/room/${nanoid(10)}`)
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
    navigateTo(`/room/${id}`)
  }
}
</script>

<template>
  <div class="flex h-screen flex-col items-center justify-center gap-6 p-4">
    <h1 class="text-2xl font-semibold">
      jaime
    </h1>

    <div class="w-full max-w-sm rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-900 dark:bg-primary-950/20">
      <h2 class="mb-1 font-medium">
        Start a new jam
      </h2>
      <p class="mb-3 text-sm text-neutral-500">
        Generates a room and takes you straight in.
      </p>
      <UButton data-testid="create-room-button" @click="createRoom">
        Create a room
      </UButton>
    </div>

    <div class="w-full max-w-sm rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 class="mb-1 font-medium">
        Join with a link or code
      </h2>
      <p class="mb-3 text-sm text-neutral-500">
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
