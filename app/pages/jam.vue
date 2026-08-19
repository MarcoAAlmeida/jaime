<script setup lang="ts">
import { evaluate, primeAudio, stop } from '~/lib/audioEngine'
import { sendPatternUpdate } from '~/plugins/websocket.client'

const { code } = useJamSession()
const error = ref<string | null>(null)

onMounted(() => {
  primeAudio()
})

function onCodeUpdate(newCode: string) {
  code.value = newCode
  sendPatternUpdate(newCode)
}

async function onEvaluate() {
  error.value = await evaluate(code.value)
}

async function onStop() {
  error.value = null
  await stop()
}
</script>

<template>
  <div class="flex h-screen flex-col gap-4 p-4">
    <h1 class="text-xl font-semibold">
      jaime
    </h1>
    <UAlert
      v-if="error"
      color="error"
      title="Pattern error"
      :description="error"
    />
    <TrackEditor
      :code="code"
      class="flex-1"
      @update:code="onCodeUpdate"
      @evaluate="onEvaluate"
      @stop="onStop"
    />
  </div>
</template>
