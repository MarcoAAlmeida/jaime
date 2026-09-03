<script setup lang="ts">
// A participant's avatar: their profile picture (GitHub) when they have
// one, an initial otherwise. Used in room rosters and chat.
const props = withDefaults(defineProps<{
  name: string
  src?: string
  size?: 'xs' | 'sm' | 'md'
}>(), { size: 'xs' })

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?')
</script>

<template>
  <UAvatar
    :src="src || undefined"
    :alt="name"
    :text="initial"
    :size="size"
    referrerpolicy="no-referrer"
  />
</template>
