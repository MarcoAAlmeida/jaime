<script setup lang="ts">
import { toStrudelUrl } from '~/lib/strudelShareLink'

// One Strudel snippet as a card: the code (as text, never HTML) with
// Preview, Copy code and Open in strudel.cc (add-jah-code-cards, design
// decision 3). Shared by the Pattern library's expanded rows and the
// chat's @jah replies — two copies of this markup would drift.
//
// The card owns Copy and Open (they depend only on `code`). Preview is
// driven by the parent (`usePatternPreview`), which is what differs between
// the library and a room; the `actions` slot (before Preview) and `aside`
// slot (after Open) let the library add its Load buttons and source link.

const props = withDefaults(defineProps<{
  code: string
  /** Hide Preview entirely (a room viewer sees Copy and Open only). */
  canPreview?: boolean
  previewing?: boolean
  previewLoading?: boolean
  /** A pattern error to show under the code. */
  error?: string | null
}>(), { canPreview: true, previewing: false, previewLoading: false, error: null })

const emit = defineEmits<{ preview: [] }>()

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyCode() {
  await navigator.clipboard.writeText(props.code)
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 1500)
}
onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <div data-testid="strudel-card" class="min-w-0">
    <pre class="text-muted bg-elevated overflow-x-auto rounded p-3 text-xs"><code>{{ code }}</code></pre>

    <UAlert
      v-if="error"
      class="mt-3"
      color="error"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      title="Pattern error"
      :description="error"
    />

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <slot name="actions" />
      <UButton
        v-if="canPreview"
        :label="previewing ? 'Stop' : 'Preview'"
        :icon="previewing ? 'i-lucide-square' : 'i-lucide-play'"
        size="xs"
        color="neutral"
        variant="outline"
        :loading="previewLoading && !previewing"
        data-testid="card-preview"
        @click="emit('preview')"
      />
      <UButton
        :label="copied ? 'Copied' : 'Copy code'"
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        size="xs"
        color="neutral"
        variant="outline"
        data-testid="card-copy"
        @click="copyCode"
      />
      <UButton
        label="Open in strudel.cc"
        icon="i-lucide-external-link"
        size="xs"
        color="neutral"
        variant="outline"
        :to="toStrudelUrl(code)"
        target="_blank"
        data-testid="card-open"
      />
      <slot name="aside" />
    </div>
  </div>
</template>
