<script setup lang="ts">
import type { TrackName } from '#shared/tracks'
import { TRACK_NAMES } from '#shared/tracks'
import { evaluate, primeAudio, stop } from '~/lib/audioEngine'
import { sendClaimTrack, sendPatternUpdate, sendReleaseTrack } from '~/plugins/websocket.client'

const { clientId, tracks } = useJamSession()
const errors = ref<Partial<Record<TrackName, string | null>>>({})

onMounted(() => {
  primeAudio()
})

function onCodeUpdate(track: TrackName, newCode: string) {
  tracks.value[track].code = newCode
  sendPatternUpdate(track, newCode)
}

async function onEvaluate(track: TrackName) {
  errors.value[track] = await evaluate(track, tracks.value[track].code)
}

async function onStop(track: TrackName) {
  errors.value[track] = null
  await stop(track)
}

function isOwnedByMe(track: TrackName) {
  return tracks.value[track].owner !== null && tracks.value[track].owner === clientId.value
}

function isUnowned(track: TrackName) {
  return tracks.value[track].owner === null
}
</script>

<template>
  <div class="flex h-screen flex-col gap-4 overflow-y-auto p-4">
    <h1 class="text-xl font-semibold">
      jaime
    </h1>
    <div
      v-for="track in TRACK_NAMES"
      :key="track"
      class="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
      :data-testid="`track-${track}`"
    >
      <div class="flex items-center gap-2">
        <span class="font-medium capitalize">{{ track }}</span>
        <UBadge v-if="isOwnedByMe(track)" color="primary" data-testid="owner-badge">
          You
        </UBadge>
        <UBadge v-else-if="!isUnowned(track)" color="neutral" data-testid="owner-badge">
          Owned
        </UBadge>
        <UBadge v-else color="neutral" variant="subtle" data-testid="owner-badge">
          Unclaimed
        </UBadge>
        <UButton
          v-if="isUnowned(track)"
          size="xs"
          data-testid="claim-button"
          @click="sendClaimTrack(track)"
        >
          Claim
        </UButton>
        <UButton
          v-else-if="isOwnedByMe(track)"
          size="xs"
          color="neutral"
          data-testid="release-button"
          @click="sendReleaseTrack(track)"
        >
          Release
        </UButton>
        <template v-if="isOwnedByMe(track)">
          <UButton
            size="xs"
            color="success"
            data-testid="play-button"
            @click="onEvaluate(track)"
          >
            Play
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            data-testid="stop-button"
            @click="onStop(track)"
          >
            Stop
          </UButton>
        </template>
      </div>
      <UAlert
        v-if="errors[track]"
        color="error"
        title="Pattern error"
        :description="errors[track]!"
      />
      <TrackEditor
        :code="tracks[track].code"
        :editable="isOwnedByMe(track)"
        class="min-h-0 flex-1"
        @update:code="(code) => onCodeUpdate(track, code)"
        @evaluate="() => onEvaluate(track)"
        @stop="() => onStop(track)"
      />
    </div>
  </div>
</template>
