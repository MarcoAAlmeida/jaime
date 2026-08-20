<script setup lang="ts">
import type { TrackName } from '#shared/tracks'
import { TRACK_NAMES } from '#shared/tracks'
import { evaluate, primeAudio, stop } from '~/lib/audioEngine'
import {
  sendClaimTrack,
  sendPatternUpdate,
  sendPlayTrack,
  sendReleaseTrack,
  sendStopTrack,
} from '~/plugins/websocket.client'

const { clientId, tracks, playRequestSeq } = useJamSession()
const errors = ref<Partial<Record<TrackName, string | null>>>({})
// Local-only, never broadcast: a personal listening preference, not
// shared room state. Muting doesn't tell anyone else anything.
const muted = ref<Record<TrackName, boolean>>(
  Object.fromEntries(TRACK_NAMES.map(name => [name, false])) as Record<TrackName, boolean>,
)

// Browsers create the AudioContext suspended until a genuine user
// gesture resumes it. evaluate() already awaits primeAudio() internally
// for every call, including the automatic one this page makes when it
// joins a room with an already-playing track — so that track's audio
// silently sits blocked until *some* click happens, with nothing on
// screen explaining why. audioUnlocked drives a visible prompt for that
// wait instead of leaving it silent and unexplained.
const audioUnlocked = ref(false)

onMounted(async () => {
  await primeAudio()
  audioUnlocked.value = true
})

// The single place that decides whether a track should actually be
// making sound for THIS client: shared playback state (broadcast, so
// everyone hears every track, per docs/01) combined with this client's
// own local mute. playRequestSeq (not just isPlaying) is in the watch
// list so re-pressing Play on an already-playing track still triggers a
// fresh evaluate() with the current code — see its comment in
// useJamSession.ts.
for (const track of TRACK_NAMES) {
  watch(
    [() => tracks.value[track].isPlaying, () => playRequestSeq.value[track], () => muted.value[track]],
    async ([isPlaying, , isMuted]) => {
      if (isPlaying && !isMuted) {
        errors.value[track] = await evaluate(track, tracks.value[track].code)
      }
      else {
        errors.value[track] = null
        await stop(track)
      }
    },
  )
}

// Editing a playing track auto-stops it (broadcast, so every client goes
// silent together) instead of trying to hot-swap the running pattern in
// place. This makes visible and audible state always agree: if a track
// shows "Playing", it's audibly playing exactly the code shown; editing
// it flips that to stopped until Play is explicitly pressed again. The
// alternative — leaving it playing and relying on re-evaluation to
// silently pick up the new code — is what produced the original
// "I changed a note but didn't hear it" confusion.
function onCodeUpdate(track: TrackName, newCode: string) {
  tracks.value[track].code = newCode
  if (tracks.value[track].isPlaying) {
    sendStopTrack(track)
  }
  sendPatternUpdate(track, newCode)
}

function togglePlayback(track: TrackName) {
  if (tracks.value[track].isPlaying) {
    sendStopTrack(track)
  }
  else {
    sendPlayTrack(track)
  }
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
    <UAlert
      v-if="!audioUnlocked"
      data-testid="audio-unlock-banner"
      color="warning"
      variant="subtle"
      title="Tap anywhere to enable audio"
      description="Your browser blocks sound until you interact with the page — any tap or click will start audio for every already-playing track, not just the one you touch."
    />
    <div
      v-for="track in TRACK_NAMES"
      :key="track"
      class="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
      :data-testid="`track-${track}`"
    >
      <div class="flex flex-wrap items-center gap-2">
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
        <UBadge
          v-if="tracks[track].isPlaying"
          color="success"
          variant="subtle"
          data-testid="playing-badge"
        >
          Playing
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
        <UButton
          v-if="isOwnedByMe(track)"
          size="xs"
          :color="tracks[track].isPlaying ? 'neutral' : 'success'"
          :variant="tracks[track].isPlaying ? 'outline' : 'solid'"
          data-testid="play-stop-button"
          @click="togglePlayback(track)"
        >
          {{ tracks[track].isPlaying ? 'Stop' : 'Play' }}
        </UButton>
        <div class="ml-auto flex items-center gap-1.5">
          <span class="text-xs text-neutral-500">Mute</span>
          <USwitch v-model="muted[track]" data-testid="mute-switch" />
        </div>
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
        @evaluate="() => sendPlayTrack(track)"
        @stop="() => sendStopTrack(track)"
      />
    </div>
  </div>
</template>
