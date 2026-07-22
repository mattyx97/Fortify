<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const { user, signOut } = useAuth()
const { data: orgs } = useOrganizationsQuery()

const currentOrgId = computed(() => route.params.orgId as string | undefined)

const currentOrg = computed(() => {
  if (!currentOrgId.value || !orgs.value)
    return null
  return orgs.value.find(o => o.organization?.id === currentOrgId.value) ?? null
})

const navItems = computed<NavigationMenuItem[]>(() => {
  if (!currentOrgId.value)
    return []
  const base = `/organizations/${currentOrgId.value}`
  return [
    { label: 'Targets', icon: 'i-lucide-crosshair', to: `${base}/targets` },
    { label: 'Templates', icon: 'i-lucide-file-text', to: `${base}/templates` },
    { label: 'Campaigns', icon: 'i-lucide-send', to: `${base}/campaigns` },
    { label: 'Members', icon: 'i-lucide-users', to: `${base}/members` },
  ]
})

const orgSelectorItems = computed<DropdownMenuItem[][]>(() => {
  if (!orgs.value)
    return []
  return [
    orgs.value.map(o => ({
      label: o.organization?.name ?? '',
      icon: currentOrgId.value === o.organization?.id ? 'i-lucide-check' : 'i-lucide-building-2',
      to: `/organizations/${o.organization?.id}`,
    })),
    [{ label: 'All Organizations', icon: 'i-lucide-layout-grid', to: '/' }],
  ]
})

const userItems: DropdownMenuItem[][] = [[
  { label: 'Sign out', icon: 'i-lucide-log-out', onSelect: () => signOut({ redirectTo: '/login' }) },
]]
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar>
      <template #header>
        <div class="flex items-center gap-2 px-1">
          <UIcon name="i-lucide-shield" class="text-primary size-6" />
          <span class="text-lg font-bold">Fortify</span>
        </div>
      </template>

      <UNavigationMenu v-if="navItems.length" :items="navItems" orientation="vertical" />

      <div v-else class="text-dimmed px-3 py-2 text-sm">
        Select an organization to begin.
      </div>

      <template #footer>
        <div class="flex w-full flex-col gap-2">
          <!-- Org selector -->
          <UDropdownMenu
            v-if="orgs?.length" :items="orgSelectorItems" class="w-full" :content="{ align: 'start', sideOffset: 4 }"
          >
            <UButton
              color="neutral" variant="soft" block class="justify-between"
            >
              <div class="flex min-w-0 items-center gap-2">
                <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
                <span class="truncate">{{ currentOrg?.organization?.name || 'Select Org' }}</span>
              </div>
              <UIcon name="i-lucide-chevrons-up-down" class="size-3 shrink-0" />
            </UButton>
          </UDropdownMenu>

          <!-- User menu -->
          <UDropdownMenu :items="userItems" class="w-full">
            <UButton color="neutral" variant="ghost" block class="justify-start">
              <UAvatar :alt="user?.name" size="xs" />
              <span class="truncate">{{ user?.name || 'Account' }}</span>
            </UButton>
          </UDropdownMenu>
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
