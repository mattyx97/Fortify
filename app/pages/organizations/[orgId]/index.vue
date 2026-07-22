<script setup lang="ts">
const route = useRoute()
await navigateTo(`/organizations/${route.params.orgId}/targets`, { replace: true })
</script>

<template>
  <div />
</template>
