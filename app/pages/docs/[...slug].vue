<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const route = useRoute()

const { data: page } = await useAsyncData(`docs-${route.path}`, () =>
  queryCollection('docs').path(route.path).first()
)

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Doc not found', fatal: true })
}

const { data: surround } = await useAsyncData(`docs-${route.path}-surround`, () =>
  queryCollectionItemSurroundings('docs', route.path)
)

useSeoMeta({
  title: () => `${page.value?.title} — jaime docs`,
  description: () => page.value?.description
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
        </UPageBody>

        <template #right>
          <UContentToc v-if="page.body?.toc?.links?.length" :links="page.body.toc.links" />
        </template>
      </UPage>
    </template>
  </UDashboardPanel>
</template>
