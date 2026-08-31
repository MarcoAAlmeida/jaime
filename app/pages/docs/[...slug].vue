<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const route = useRoute()
const { user } = useAuth()

const { data: page } = await useAsyncData(`docs-${route.path}`, async () => {
  const doc = await queryCollection('docs').path(route.path).first()
  if (doc?.authRequired && !user.value) {
    // Serve metadata only — the prose must not reach an anonymous
    // request (docs-shell spec).
    return { ...doc, body: { type: 'minimal', value: [] }, locked: true }
  }
  return doc ? { ...doc, locked: false } : doc
})

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Doc not found', fatal: true })
}

const { data: surround } = await useAsyncData(`docs-${route.path}-surround`, () =>
  queryCollectionItemSurroundings('docs', route.path),
)

useSeoMeta({
  title: () => `${page.value?.title} — jaime docs`,
  description: () => page.value?.description,
})

const tocLinks = computed(() => {
  if (page.value?.locked) return []
  return (page.value?.body as { toc?: { links?: unknown[] } } | undefined)?.toc?.links ?? []
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPage v-if="page">
        <UPageHeader :title="page.title" :description="page.description" />

        <UPageBody>
          <div
            v-if="page.locked"
            class="border-default rounded-lg border p-8 text-center"
            data-testid="doc-locked"
          >
            <UIcon name="i-lucide-lock" class="text-dimmed mx-auto mb-3 size-6" />
            <p class="text-highlighted font-medium">Sign in to read this</p>
            <p class="text-muted mx-auto mt-1 max-w-sm text-sm">
              This page is for people with a jaime account. Signing in takes a
              minute and no password.
            </p>
            <UButton
              class="mt-4"
              label="Sign in"
              icon="i-lucide-log-in"
              :to="`/signup?next=${encodeURIComponent(route.path)}`"
              data-testid="doc-locked-signin"
            />
          </div>

          <template v-else>
            <UAlert
              v-if="page.placeholder"
              class="mb-6"
              color="warning"
              variant="subtle"
              icon="i-lucide-construction"
              title="Placeholder"
              description="This section's real content is written in a later phase. The page exists now so the nav tree and structure are in place."
            />

            <ContentRenderer :value="page" />

            <USeparator class="my-8" />

            <UContentSurround :surround="surround" />
          </template>
        </UPageBody>

        <template #right>
          <UContentToc v-if="tocLinks.length" :links="(tocLinks as any)" />
        </template>
      </UPage>
    </template>
  </UDashboardPanel>
</template>
