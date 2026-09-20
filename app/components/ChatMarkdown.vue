<script setup lang="ts">
// One chat message's Markdown. All the safety lives in renderChatMarkdown
// (app/lib/chatMarkdown.ts, tested) — this only mounts its output.
import { renderChatMarkdown } from '~/lib/chatMarkdown'

const props = defineProps<{ text: string }>()

const html = computed(() => renderChatMarkdown(props.text))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="chat-md" v-html="html" />
</template>

<style scoped>
.chat-md {
  min-width: 0;
  overflow-wrap: anywhere;
}
.chat-md > :deep(:first-child) { margin-top: 0; }
.chat-md > :deep(:last-child) { margin-bottom: 0; }
.chat-md :deep(p) { margin: 0.35em 0; }
.chat-md :deep(ul),
.chat-md :deep(ol) { margin: 0.35em 0; padding-left: 1.25em; }
.chat-md :deep(ul) { list-style: disc; }
.chat-md :deep(ol) { list-style: decimal; }
.chat-md :deep(h1),
.chat-md :deep(h2),
.chat-md :deep(h3),
.chat-md :deep(h4),
.chat-md :deep(h5),
.chat-md :deep(h6) { margin: 0.5em 0 0.25em; font-size: 1em; font-weight: 600; }
.chat-md :deep(blockquote) {
  margin: 0.35em 0;
  padding-left: 0.75em;
  border-left: 2px solid var(--ui-border-accented);
  color: var(--ui-text-muted);
}
.chat-md :deep(a) { text-decoration: underline; text-underline-offset: 2px; }
.chat-md :deep(code) {
  padding: 0.1em 0.3em;
  border-radius: 0.25rem;
  background: var(--ui-bg-accented);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.9em;
}
.chat-md :deep(pre) {
  margin: 0.35em 0;
  padding: 0.5em 0.75em;
  border-radius: 0.375rem;
  background: var(--ui-bg-accented);
  overflow-x: auto;
}
.chat-md :deep(pre code) { padding: 0; background: none; white-space: pre; }
</style>
