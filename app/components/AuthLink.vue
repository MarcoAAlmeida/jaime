<script setup lang="ts">
withDefaults(defineProps<{ block?: boolean }>(), { block: false })
const { user } = useAuth()
</script>

<template>
  <UButton
    v-if="user"
    :label="user.displayName"
    icon="i-lucide-circle-user"
    color="neutral"
    variant="ghost"
    size="sm"
    :block="block"
    to="/account"
    data-testid="account-link"
  />
  <UButton
    v-else
    label="Sign in"
    icon="i-lucide-log-in"
    color="neutral"
    variant="ghost"
    size="sm"
    :block="block"
    to="/signup"
    data-testid="signin-link"
  />
</template>
