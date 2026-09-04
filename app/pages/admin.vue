<script setup lang="ts">
import type { AdminUser, AiUsageRecord } from '#shared/admin'

// `operator` alone, not `auth` — a non-operator (signed in or not) must
// get the not-found page, never a redirect to sign-in that reveals the
// route exists (spec: "treated as a missing page").
definePageMeta({ layout: 'landing', middleware: 'operator' })
useSeoMeta({ title: 'Admin — jaime' })

const { data: fetchedUsers, error: usersError } = await useFetch<AdminUser[]>('/api/admin/users')
const { data: usage } = await useFetch<AiUsageRecord[]>('/api/admin/usage')

// A local copy the switches bind to — mutated in place on toggle so the
// row re-renders without a full refetch.
const users = ref<AdminUser[]>(fetchedUsers.value ?? [])
watch(fetchedUsers, v => (users.value = v ?? []))

const toggleError = ref('')

async function setAccess(u: AdminUser, next: boolean) {
  toggleError.value = ''
  try {
    const updated = await $fetch<AdminUser>(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      body: { aiAccess: next },
    })
    const i = users.value.findIndex(r => r.id === u.id)
    if (i !== -1) users.value[i] = updated
  }
  catch {
    toggleError.value = `Couldn't update ${u.displayName}. Try again.`
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <UPageSection headline="Admin" title="Accounts & @jah access">
    <div class="flex w-full flex-col gap-10">
      <UAlert
        v-if="usersError"
        color="error"
        title="Couldn't load accounts"
        :description="String(usersError)"
      />

      <!-- Accounts -->
      <section class="flex flex-col gap-3">
        <h2 class="text-muted text-xs font-medium uppercase tracking-wide">
          Accounts ({{ users?.length ?? 0 }})
        </h2>
        <UAlert v-if="toggleError" color="error" :description="toggleError" />
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-left text-sm" data-testid="admin-accounts">
            <thead class="text-muted border-default border-b">
              <tr>
                <th class="py-2 pr-3 font-medium">Name</th>
                <th class="py-2 pr-3 font-medium">Email</th>
                <th class="py-2 pr-3 font-medium">GitHub</th>
                <th class="py-2 pr-3 font-medium">Status</th>
                <th class="py-2 pr-3 font-medium">Joined</th>
                <th class="py-2 pr-3 font-medium">@jah access</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="u in users"
                :key="u.id"
                class="border-default/60 border-b"
                data-testid="admin-account-row"
                :data-email="u.email"
              >
                <td class="py-2 pr-3">{{ u.displayName }}</td>
                <td class="py-2 pr-3">{{ u.email }}</td>
                <td class="text-muted py-2 pr-3">{{ u.githubLogin ?? '—' }}</td>
                <td class="py-2 pr-3">
                  <UBadge
                    :color="u.status === 'confirmed' ? 'success' : 'neutral'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ u.status }}
                  </UBadge>
                </td>
                <td class="text-muted py-2 pr-3">{{ fmtDate(u.createdAt) }}</td>
                <td class="py-2 pr-3">
                  <div class="flex items-center gap-2">
                    <USwitch
                      :model-value="u.aiAccess"
                      data-testid="admin-access-switch"
                      @update:model-value="setAccess(u, $event)"
                    />
                    <span
                      v-if="u.effectiveAccess === 'allowlist'"
                      class="text-muted text-xs"
                    >on via allowlist</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Usage -->
      <section class="flex flex-col gap-3">
        <h2 class="text-muted text-xs font-medium uppercase tracking-wide">
          Recent @jah usage
        </h2>
        <p v-if="!usage?.length" class="text-muted text-sm" data-testid="admin-usage-empty">
          No @jah usage recorded yet.
        </p>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-left text-sm" data-testid="admin-usage">
            <thead class="text-muted border-default border-b">
              <tr>
                <th class="py-2 pr-3 font-medium">When</th>
                <th class="py-2 pr-3 font-medium">Account</th>
                <th class="py-2 pr-3 font-medium">Room</th>
                <th class="py-2 pr-3 font-medium">Model</th>
                <th class="py-2 pr-3 font-medium">Tokens (in / out)</th>
                <th class="py-2 pr-3 font-medium">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in usage" :key="r.id" class="border-default/60 border-b">
                <td class="text-muted py-2 pr-3">{{ fmtWhen(r.createdAt) }}</td>
                <td class="py-2 pr-3">{{ r.githubLogin ?? r.userId }}</td>
                <td class="text-muted py-2 pr-3">{{ r.roomId ?? '—' }}</td>
                <td class="py-2 pr-3">{{ r.model }}</td>
                <td class="text-muted py-2 pr-3">{{ r.promptTokens }} / {{ r.completionTokens }}</td>
                <td class="text-muted py-2 pr-3">${{ r.costEstimateUsd.toFixed(4) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </UPageSection>
</template>
