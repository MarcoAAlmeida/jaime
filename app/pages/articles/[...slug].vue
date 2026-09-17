<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const route = useRoute()
const { user } = useAuth()

const { data: page } = await useAsyncData(`article-${route.path}`, async () => {
  const article = await queryCollection('articles').path(route.path).first()
  if (article?.authRequired && !user.value) {
    // Serve metadata only — the prose must not reach an anonymous
    // request (articles spec, mirrors docs-shell's own contract).
    return { ...article, body: { type: 'minimal', value: [] }, locked: true }
  }
  return article ? { ...article, locked: false } : article
})

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Article not found', fatal: true })
}

useSeoMeta({
  title: () => `${page.value?.title} — jaime`,
  description: () => page.value?.description,
})

const tocLinks = computed(() => {
  if (page.value?.locked) return []
  return (page.value?.body as { toc?: { links?: unknown[] } } | undefined)?.toc?.links ?? []
})
</script>

<template>
  <UPage v-if="page">
    <UPageHeader :title="page.title" :description="page.description" />

    <UPageBody>
      <div
        v-if="page.locked"
        class="border-default rounded-lg border p-8 text-center"
        data-testid="article-locked"
      >
        <UIcon name="i-lucide-lock" class="text-dimmed mx-auto mb-3 size-6" />
        <p class="text-highlighted font-medium">
          Sign in to read this
        </p>
        <p class="text-muted mx-auto mt-1 max-w-sm text-sm">
          This article is for people with a jaime account. Signing in
          takes a minute and no password.
        </p>
        <UButton
          class="mt-4"
          label="Sign in"
          icon="i-lucide-log-in"
          :to="`/signup?next=${encodeURIComponent(route.path)}`"
          data-testid="article-locked-signin"
        />
      </div>

      <ContentRenderer v-else :value="page" />
    </UPageBody>

    <template #right>
      <UContentToc v-if="tocLinks.length" :links="(tocLinks as any)" />
    </template>
  </UPage>
</template>
