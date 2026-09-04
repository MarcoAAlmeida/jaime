<script setup lang="ts">
withDefaults(defineProps<{ block?: boolean }>(), { block: false })
const { user } = useAuth()
</script>

<template>
  <UButton
    v-if="user"
    :label="user.displayName"
    :icon="user.avatarUrl ? undefined : 'i-lucide-circle-user'"
    color="neutral"
    variant="ghost"
    size="sm"
    :block="block"
    to="/account"
    data-testid="account-link"
  >
    <template v-if="user.avatarUrl" #leading>
      <UserAvatar :name="user.displayName" :src="user.avatarUrl" size="xs" />
    </template>
  </UButton>
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
