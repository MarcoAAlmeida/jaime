<script setup lang="ts">
import { evaluate, primeAudio, stop } from '~/lib/audioEngine'

const { code } = useJamSession()
const error = ref<string | null>(null)

onMounted(() => {
  primeAudio()
})

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
      v-model:code="code"
      class="flex-1"
      @evaluate="onEvaluate"
      @stop="onStop"
    />
  </div>
</template>
