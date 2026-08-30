<script setup lang="ts">
definePageMeta({ layout: 'landing' })

useSeoMeta({ title: 'Join the community — jaime' })

// Mock only. No email is sent — real confirmation email (Cloudflare
// Email Sending on jaime.stream) is deliberately deferred to a later
// phase. The form just acknowledges the address locally.
const email = ref('')
const submitted = ref(false)

function submit() {
  if (!email.value.includes('@')) return
  submitted.value = true
}
</script>

<template>
  <UPageSection
    headline="Community"
    title="Join the list"
    description="One email when a new tool lands. Nothing else."
  >
    <div class="mx-auto w-full max-w-md">
      <UAlert
        class="mb-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-construction"
        title="Coming soon"
        description="Signup isn't live yet — submitting this form won't send a confirmation email or store your address anywhere. It's a preview of the real thing."
      />

      <form
        v-if="!submitted"
        class="flex gap-2"
        data-testid="signup-form"
        @submit.prevent="submit"
      >
        <UInput
          v-model="email"
          type="email"
          placeholder="you@example.com"
          class="flex-1"
          data-testid="signup-email"
          required
        />
        <UButton type="submit" label="Notify me" data-testid="signup-submit" />
      </form>

      <UAlert
        v-else
        color="success"
        variant="subtle"
        icon="i-lucide-check"
        title="Got it (well — pretend we did)"
        :description="`If this were live, we'd send a confirmation to ${email}. For now, nothing was sent or saved.`"
        data-testid="signup-ack"
      />
    </div>
  </UPageSection>
</template>
