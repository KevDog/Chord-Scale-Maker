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
  // key: a page may name another canonical (a tune's version, #411)
  link: [{ rel: 'canonical', href: () => canonicalUrl(route.path), key: 'canonical' }],
})
useSeoMeta({ ogUrl: () => canonicalUrl(route.path) })
</script>
