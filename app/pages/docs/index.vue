<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const { data: page } = await useAsyncData('docs-home', () =>
  queryCollection('docs').path('/docs').first()
)

useSeoMeta({
  title: 'Docs — jaime',
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
          <ContentRenderer :value="page" />
        </UPageBody>
        <template #right>
          <UContentToc v-if="page.body?.toc?.links?.length" :links="page.body.toc.links" />
        </template>
      </UPage>
    </template>
  </UDashboardPanel>
</template>
