<template>
  <AppShell>
    <NuxtLoadingIndicator />
    <NuxtPage />
  </AppShell>
</template>

<script setup lang="ts">
import { canonicalUrl, pageTitle } from '~/utils/site'

const route = useRoute()
useHead({
  titleTemplate: (title) => pageTitle(title),
  link: [{ rel: 'canonical', href: () => canonicalUrl(route.path) }],
})
useSeoMeta({ ogUrl: () => canonicalUrl(route.path) })
</script>
