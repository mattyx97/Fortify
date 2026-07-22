<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const toast = useToast()
const { user } = useAuth()
const orgId = computed(() => route.params.orgId as string)

const { data: members, isPending } = useMembersQuery(orgId)
const { addMember, updateMemberRole, removeMember } = useMemberMutations()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const columns: TableColumn<Record<string, unknown>>[] = [
  { accessorKey: 'user.name', header: 'Name' },
  { accessorKey: 'user.email', header: 'Email' },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => h(UBadge, {
      color: (row.original as Record<string, unknown>).role === 'company_admin' ? 'primary' : 'neutral',
      variant: 'subtle',
      class: 'capitalize',
    }, () => String((row.original as Record<string, unknown>).role).replace('_', ' ')),
  },
  {
    id: 'actions',
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) => {
      const member = row.original as Record<string, unknown>
      const memberUser = member.user as Record<string, unknown> | undefined
      const isSelf = memberUser?.id === user.value?.id
      const buttons = []

      if (!isSelf) {
        buttons.push(h(UButton, {
          icon: 'i-lucide-arrow-up-down',
          color: 'neutral',
          variant: 'ghost',
          size: 'xs',
          label: member.role === 'company_admin' ? 'Make Analyst' : 'Make Admin',
          onClick: () => updateMemberRole.mutate({
            orgId: orgId.value,
            memberId: String(member.id),
            body: { role: member.role === 'company_admin' ? 'analyst' : 'company_admin' },
          }),
        }))
        buttons.push(h(UButton, {
          icon: 'i-lucide-trash-2',
          color: 'error',
          variant: 'ghost',
          size: 'xs',
          onClick: () => removeMember.mutate({ orgId: orgId.value, memberId: String(member.id) }),
        }))
      }

      return h('div', { class: 'flex gap-1 justify-end' }, buttons)
    },
  },
]

// Invite modal
const showInvite = ref(false)
const inviteForm = ref({ email: '', role: 'analyst' as 'company_admin' | 'analyst' })

async function handleInvite() {
  if (!inviteForm.value.email.trim())
    return
  try {
    await addMember.mutateAsync({
      orgId: orgId.value,
      body: { email: inviteForm.value.email.trim(), role: inviteForm.value.role },
    })
    toast.add({ title: 'Member added', color: 'success', icon: 'i-lucide-check' })
    inviteForm.value = { email: '', role: 'analyst' }
    showInvite.value = false
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to add member', color: 'error', icon: 'i-lucide-circle-x' })
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Members">
        <template #right>
          <UButton icon="i-lucide-user-plus" label="Invite Member" @click="showInvite = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <div class="p-6">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          Members
        </h2>
        <UButton icon="i-lucide-user-plus" label="Invite Member" @click="showInvite = true" />
      </div>
      <div v-if="isPending" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
      </div>
      <div v-else-if="!members?.length" class="py-12 text-center">
        <UIcon name="i-lucide-users" class="text-dimmed mx-auto mb-4 size-12" />
        <p class="text-lg font-medium">
          No members
        </p>
      </div>
      <UTable v-else :data="members" :columns="columns" />
    </div>

    <UModal v-model:open="showInvite" title="Invite Member">
      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField label="Email">
            <UInput
              v-model="inviteForm.email" type="email" placeholder="colleague@company.com" class="
                w-full
              " autofocus @keydown.enter="handleInvite"
            />
          </UFormField>
          <UFormField label="Role">
            <USelect
              v-model="inviteForm.role" :items="[{ label: 'Analyst', value: 'analyst' }, { label: 'Company Admin', value: 'company_admin' }]" class="
                w-full
              "
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" @click="showInvite = false" />
          <UButton label="Invite" :loading="addMember.isPending.value" @click="handleInvite" />
        </div>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
