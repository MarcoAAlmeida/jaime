<script setup lang="ts">
// jaime's mark — the interlocked "ja" monogram (design/assets/logo.png,
// the same art the favicons come from). Used on its own; the wordmark
// is the URL and the tab.
withDefaults(defineProps<{ size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<template>
  <img
    src="/logo.png"
    alt="jaime"
    draggable="false"
    class="shrink-0 select-none"
    :class="size === 'sm' ? 'size-7' : 'size-9'"
    width="36"
    height="36"
  >
</template>
