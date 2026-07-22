<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { data: orgs, isPending } = useOrganizationsQuery()
const { createOrganization } = useOrganizationMutations()
const toast = useToast()

const showCreateModal = ref(false)
const newOrgName = ref('')

async function handleCreate() {
  if (!newOrgName.value.trim())
    return
  try {
    await createOrganization.mutateAsync({ body: { name: newOrgName.value.trim() } })
    toast.add({ title: 'Organization created', color: 'success', icon: 'i-lucide-check' })
    newOrgName.value = ''
    showCreateModal.value = false
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to create', color: 'error', icon: 'i-lucide-circle-x' })
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Organizations">
        <template #leading>
          <UDashboardSidebarToggle />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="New Organization" @click="() => { showCreateModal = true }" />
        </template>
      </UDashboardNavbar>
    </template>

    <div class="p-6">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          Organizations
        </h2>
        <UButton icon="i-lucide-plus" label="New Organization" @click="() => { showCreateModal = true }" />
      </div>

      <div v-if="isPending" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
      </div>

      <div v-else-if="!orgs?.length" class="py-12 text-center">
        <UIcon
          name="i-lucide-building-2" class="text-dimmed mx-auto mb-4 size-12"
        />
        <p class="text-lg font-medium">
          No organizations yet
        </p>
        <p class="text-dimmed mt-1">
          Create your first organization to get started.
        </p>
        <UButton class="mt-4" icon="i-lucide-plus" label="Create Organization" @click="() => { showCreateModal = true }" />
      </div>

      <div
        v-else class="
          grid gap-4
          sm:grid-cols-2
          lg:grid-cols-3
        "
      >
        <UCard v-for="item in orgs" :key="item.organization?.id">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-highlighted font-semibold">
                {{ item.organization?.name }}
              </p>
              <UBadge
                :color="item.role === 'company_admin' ? 'primary' : 'neutral'" variant="subtle" class="
                  mt-2 capitalize
                "
              >
                {{ item.role.replace('_', ' ') }}
              </UBadge>
            </div>
            <UButton
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="ghost"
              :to="`/organizations/${item.organization?.id}`"
            />
          </div>
        </UCard>
      </div>
    </div>

    <UModal v-model:open="showCreateModal" title="New Organization">
      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField label="Organization Name">
            <UInput v-model="newOrgName" placeholder="Acme SpA" class="w-full" autofocus @keydown.enter="handleCreate" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" @click="() => { showCreateModal = false }" />
          <UButton label="Create" :loading="createOrganization.isPending.value" @click="handleCreate" />
        </div>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
