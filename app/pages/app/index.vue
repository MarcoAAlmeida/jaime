<script setup lang="ts">
// The dashboard root has no view of its own — JAM is the only real
// tool, so /app lands there. (Also covered by a routeRules redirect for
// server-side hits; this handles client-side navigation to /app.)
definePageMeta({ layout: false })
await navigateTo('/app/jam', { redirectCode: 302, replace: true })
</script>

<template>
  <div />
</template>
