<script setup lang="ts">
// A person's avatar: their profile picture (GitHub) when they have one,
// an initial otherwise. Used in room rosters, chat, the sidebar account
// link and the account page.
const props = withDefaults(defineProps<{
  name: string
  src?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
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
