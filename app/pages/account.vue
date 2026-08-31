<script setup lang="ts">
definePageMeta({ layout: 'landing', middleware: 'auth' })
useSeoMeta({ title: 'Account — jaime' })

const { user, updateDisplayName, signOut, deleteAccount } = useAuth()

const name = ref(user.value?.displayName ?? '')
const savingName = ref(false)
const nameSaved = ref(false)

async function saveName() {
  const trimmed = name.value.trim()
  if (!trimmed || trimmed === user.value?.displayName) return
  savingName.value = true
  try {
    await updateDisplayName(trimmed)
    nameSaved.value = true
    setTimeout(() => (nameSaved.value = false), 1500)
  }
  finally {
    savingName.value = false
  }
}

const confirmingDelete = ref(false)
const deleting = ref(false)
async function confirmDelete() {
  deleting.value = true
  await deleteAccount()
}
</script>

<template>
  <UPageSection headline="Account" title="Your account">
    <div class="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <p class="text-muted text-sm">Signed in as</p>
        <p class="font-medium">{{ user?.email }}</p>
        <p v-if="user?.status === 'pending'" class="text-warning text-xs mt-1">
          Not confirmed yet — use the link we emailed you.
        </p>
      </div>

      <form class="flex flex-col gap-2" @submit.prevent="saveName">
        <label class="text-muted text-sm">Display name</label>
        <div class="flex gap-2">
          <UInput v-model="name" class="flex-1" data-testid="account-name" />
          <UButton
            type="submit"
            :label="nameSaved ? 'Saved' : 'Save'"
            :icon="nameSaved ? 'i-lucide-check' : undefined"
            :loading="savingName"
            :disabled="!name.trim() || name.trim() === user?.displayName"
            data-testid="account-name-save"
          />
        </div>
      </form>

      <USeparator />

      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton
          label="Sign out"
          icon="i-lucide-log-out"
          color="neutral"
          variant="outline"
          data-testid="account-signout"
          @click="signOut"
        />
        <UButton
          v-if="!confirmingDelete"
          label="Delete account"
          color="error"
          variant="ghost"
          data-testid="account-delete"
          @click="confirmingDelete = true"
        />
        <div v-else class="flex items-center gap-2">
          <span class="text-sm">Delete permanently?</span>
          <UButton
            label="Yes, delete"
            color="error"
            size="sm"
            :loading="deleting"
            data-testid="account-delete-confirm"
            @click="confirmDelete"
          />
          <UButton label="Cancel" color="neutral" variant="ghost" size="sm" @click="confirmingDelete = false" />
        </div>
      </div>
    </div>
  </UPageSection>
</template>
