<script setup lang="ts">
definePageMeta({ layout: 'landing' })
useSeoMeta({ title: 'Sign in — jaime' })

const route = useRoute()
const { user, requestLink } = useAuth()

// Already signed in → nothing to do here.
watchEffect(() => {
  if (user.value) navigateTo(safeNext(route.query.next) ?? '/account')
})

function safeNext(v: unknown): string | undefined {
  return typeof v === 'string' && v.startsWith('/') ? v : undefined
}

const email = ref('')
const displayName = ref('')
const state = ref<'idle' | 'sending' | 'sent'>('idle')
const errorMsg = ref<string | null>(null)
const devLink = ref<string | null>(null)

// Offer a name field when we have a session name to carry over.
const sessionName = useState<string>('display-name')
onMounted(() => {
  if (sessionName.value) displayName.value = sessionName.value
})

const linkError = computed(() => route.query.error === 'link')

async function submit() {
  if (!email.value.includes('@')) return
  state.value = 'sending'
  errorMsg.value = null
  try {
    const res = await requestLink(
      email.value,
      displayName.value || undefined,
      safeNext(route.query.next) ?? '/account',
    )
    devLink.value = res.devLink ?? null
    state.value = 'sent'
  }
  catch (e) {
    errorMsg.value = (e as { statusMessage?: string }).statusMessage ?? 'Something went wrong.'
    state.value = 'idle'
  }
}
</script>

<template>
  <UPageSection
    headline="Account"
    title="Sign in"
    description="No password — we email you a link. Same form whether you're new or returning; tools work without an account."
  >
    <div class="mx-auto w-full max-w-md">
      <UAlert
        v-if="linkError"
        class="mb-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-link-2-off"
        title="That link is no longer valid"
        description="Sign-in links work once and expire after 15 minutes. Request a new one below."
      />

      <form
        v-if="state !== 'sent'"
        class="flex flex-col gap-3"
        data-testid="signin-form"
        @submit.prevent="submit"
      >
        <UInput
          v-model="email"
          type="email"
          placeholder="you@example.com"
          size="lg"
          class="w-full"
          data-testid="signin-email"
          autocomplete="email"
          required
        />
        <UInput
          v-model="displayName"
          placeholder="Display name (optional)"
          class="w-full"
          data-testid="signin-name"
          autocomplete="nickname"
        />
        <UButton
          type="submit"
          label="Email me a sign-in link"
          block
          :loading="state === 'sending'"
          data-testid="signin-submit"
        />
        <p v-if="errorMsg" class="text-error text-sm">
          {{ errorMsg }}
        </p>
      </form>

      <div v-else data-testid="signin-sent">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-mail-check"
          :title="`Check ${email}`"
          description="We sent a sign-in link. It works once and expires in 15 minutes — check spam if it's not there."
        />
        <UButton
          class="mt-3"
          label="Use a different email"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="state = 'idle'"
        />
        <p v-if="devLink" class="mt-4 text-xs">
          <span class="text-dimmed">dev link: </span>
          <ULink :to="devLink" class="text-primary break-all" data-testid="dev-link">{{ devLink }}</ULink>
        </p>
      </div>
    </div>
  </UPageSection>
</template>
