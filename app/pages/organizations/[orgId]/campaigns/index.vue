<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const toast = useToast()
const orgId = computed(() => route.params.orgId as string)

const { data: campaigns, isPending } = useCampaignsQuery(orgId)
const { data: templates } = useTemplatesQuery(orgId)
const { data: targets } = useTargetsQuery(orgId)
const { createCampaign, updateCampaignStatus, deleteCampaign } = useCampaignMutations()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

const statusColors: Record<string, 'neutral' | 'warning' | 'success'> = {
  draft: 'neutral',
  active: 'warning',
  completed: 'success',
}

const channelIcons: Record<string, string> = {
  email: 'i-lucide-mail',
  sms: 'i-lucide-message-square',
}

const columns: TableColumn<Record<string, unknown>>[] = [
  { accessorKey: 'name', header: 'Name' },
  {
    id: 'channel',
    header: 'Channel',
    cell: ({ row }) => {
      const c = row.original as Record<string, unknown>
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h(resolveComponent('UIcon'), { name: channelIcons[c.channel as string] || 'i-lucide-send', class: 'size-4' }),
        h('span', { class: 'capitalize' }, c.channel as string),
      ])
    },
  },
  {
    id: 'template',
    header: 'Template',
    cell: ({ row }) => {
      const t = (row.original as Record<string, unknown>).template as Record<string, unknown> | null
      return t?.name ?? '-'
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const c = row.original as Record<string, unknown>
      return h(UBadge, { color: statusColors[c.status as string] || 'neutral', variant: 'subtle', class: 'capitalize' }, () => c.status)
    },
  },
  {
    id: 'actions',
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) => {
      const c = row.original as Record<string, unknown>
      const buttons = []

      if (c.status === 'draft') {
        buttons.push(h(UButton, {
          icon: 'i-lucide-play',
          color: 'success',
          variant: 'ghost',
          size: 'xs',
          onClick: () => handleStatusChange(String(c.id), 'active'),
        }))
      }
      if (c.status === 'active') {
        buttons.push(h(UButton, {
          icon: 'i-lucide-check-circle',
          color: 'primary',
          variant: 'ghost',
          size: 'xs',
          onClick: () => handleStatusChange(String(c.id), 'completed'),
        }))
      }
      buttons.push(h(UButton, {
        icon: 'i-lucide-eye',
        color: 'neutral',
        variant: 'ghost',
        size: 'xs',
        to: `/organizations/${orgId.value}/campaigns/${c.id}`,
      }))
      if (c.status === 'draft') {
        buttons.push(h(UButton, {
          icon: 'i-lucide-trash-2',
          color: 'error',
          variant: 'ghost',
          size: 'xs',
          onClick: () => handleDelete(String(c.id)),
        }))
      }

      return h('div', { class: 'flex gap-1 justify-end' }, buttons)
    },
  },
]

async function handleStatusChange(campaignId: string, status: 'active' | 'completed') {
  try {
    await updateCampaignStatus.mutateAsync({ orgId: orgId.value, campaignId, status })
    toast.add({ title: `Campaign ${status === 'active' ? 'launched' : 'completed'}`, color: 'success', icon: 'i-lucide-check' })
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

async function handleDelete(campaignId: string) {
  try {
    await deleteCampaign.mutateAsync({ orgId: orgId.value, campaignId })
    toast.add({ title: 'Campaign deleted', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

// ===== CREATE WIZARD =====
const showCreate = ref(false)
const step = ref(1)
const campaignForm = ref({
  name: '',
  description: '',
  templateId: '',
  channel: 'email' as 'email' | 'sms',
  targetIds: [] as string[],
})

const selectedTemplate = computed(() =>
  templates.value?.find(t => t.id === campaignForm.value.templateId),
)

const filteredTemplates = computed(() =>
  templates.value?.filter(t => t.channel === campaignForm.value.channel) ?? [],
)

const needsPhone = computed(() => campaignForm.value.channel === 'sms')

const filteredTargets = computed(() => {
  if (!targets.value)
    return []
  if (!needsPhone.value)
    return targets.value
  return targets.value.filter((t: Record<string, unknown>) => !!t.phoneNumber)
})

const excludedTargetsCount = computed(() => {
  if (!targets.value || !needsPhone.value)
    return 0
  return targets.value.length - filteredTargets.value.length
})

function openCreate() {
  step.value = 1
  campaignForm.value = { name: '', description: '', templateId: '', channel: 'email', targetIds: [] }
  showCreate.value = true
}

function nextStep() {
  if (step.value < 3)
    step.value++
}

function prevStep() {
  if (step.value > 1)
    step.value--
}

function toggleTarget(targetId: string) {
  const idx = campaignForm.value.targetIds.indexOf(targetId)
  if (idx >= 0)
    campaignForm.value.targetIds.splice(idx, 1)
  else campaignForm.value.targetIds.push(targetId)
}

function selectAllTargets() {
  campaignForm.value.targetIds = filteredTargets.value.map((t: Record<string, unknown>) => String(t.id))
}

// Reset target selection when channel changes (to exclude targets missing phone)
watch(() => campaignForm.value.channel, () => {
  campaignForm.value.targetIds = []
})

async function handleCreate() {
  try {
    await createCampaign.mutateAsync({
      orgId: orgId.value,
      body: {
        name: campaignForm.value.name,
        description: campaignForm.value.description || undefined,
        templateId: campaignForm.value.templateId,
        channel: campaignForm.value.channel,
        targetIds: campaignForm.value.targetIds,
      },
    })
    toast.add({ title: 'Campaign created', color: 'success', icon: 'i-lucide-check' })
    showCreate.value = false
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to create', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

const canNext = computed(() => {
  if (step.value === 1)
    return campaignForm.value.name && campaignForm.value.templateId
  if (step.value === 2)
    return campaignForm.value.targetIds.length > 0
  return true
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Campaigns" />
    </template>

    <div class="p-6">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          Campaigns
        </h2>
        <UButton icon="i-lucide-plus" label="New Campaign" @click="openCreate" />
      </div>

      <div v-if="isPending" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
      </div>

      <div v-else-if="!campaigns?.length" class="py-12 text-center">
        <UIcon name="i-lucide-send" class="text-dimmed mx-auto mb-4 size-12" />
        <p class="text-lg font-medium">
          No campaigns yet
        </p>
        <p class="text-dimmed mt-1">
          Create your first phishing simulation campaign.
        </p>
        <UButton class="mt-4" icon="i-lucide-plus" label="New Campaign" @click="openCreate" />
      </div>

      <UTable v-else :data="campaigns" :columns="columns" />
    </div>

    <!-- Create Campaign Wizard -->
    <UModal v-model:open="showCreate" :title="`New Campaign — Step ${step}/3`">
      <template #body>
        <!-- Step 1: Details + Template -->
        <div v-if="step === 1" class="flex flex-col gap-3">
          <UFormField label="Campaign Name" required>
            <UInput
              v-model="campaignForm.name" placeholder="Q1 Security Test" class="
                w-full
              "
            />
          </UFormField>
          <UFormField label="Description">
            <UInput
              v-model="campaignForm.description" placeholder="Testing IT department awareness..." class="
                w-full
              "
            />
          </UFormField>
          <UFormField label="Channel" required>
            <USelect
              v-model="campaignForm.channel"
              :items="[{ label: 'Email', value: 'email' }, { label: 'SMS', value: 'sms' }]"
              class="w-full"
              @update:model-value="campaignForm.templateId = ''"
            />
          </UFormField>
          <UFormField label="Template" required>
            <USelect
              v-model="campaignForm.templateId"
              :items="filteredTemplates.map((t) => ({ label: String(t.name), value: String(t.id) }))"
              placeholder="Select a template..."
              class="w-full"
            />
          </UFormField>
          <div
            v-if="selectedTemplate" class="bg-accented rounded-md p-3 text-sm"
          >
            <p class="font-medium">
              {{ selectedTemplate.name }}
            </p>
            <p v-if="selectedTemplate.description" class="text-dimmed mt-1">
              {{ selectedTemplate.description }}
            </p>
          </div>
        </div>

        <!-- Step 2: Select Targets -->
        <div v-if="step === 2" class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <p class="text-dimmed text-sm">
              {{ campaignForm.targetIds.length }} target(s) selected
            </p>
            <UButton size="xs" variant="outline" label="Select All" @click="selectAllTargets" />
          </div>

          <div
            v-if="needsPhone && excludedTargetsCount > 0" class="
              border-warning/30 bg-warning/5 rounded-md border p-2 text-xs
            "
          >
            <div class="flex items-center gap-1.5">
              <UIcon
                name="i-lucide-alert-triangle" class="text-warning size-3.5"
              />
              <span class="text-dimmed">
                {{ excludedTargetsCount }} target(s) hidden — missing phone number (required for {{ campaignForm.channel }})
              </span>
            </div>
          </div>

          <div
            v-if="!filteredTargets.length" class="text-dimmed py-6 text-center"
          >
            <template v-if="!targets?.length">
              No targets available. Add targets first.
            </template>
            <template v-else>
              No targets with phone number available for {{ campaignForm.channel }} campaigns.
            </template>
          </div>
          <div v-else class="flex max-h-64 flex-col gap-2 overflow-y-auto">
            <div
              v-for="target in filteredTargets"
              :key="(target as Record<string, unknown>).id as string"
              class="
                flex cursor-pointer items-center gap-3 rounded-md p-2
                transition-colors
              "
              :class="campaignForm.targetIds.includes(String((target as Record<string, unknown>).id)) ? `
                bg-primary/10 ring-primary ring-1
              ` : `hover:bg-accented`"
              @click="toggleTarget(String((target as Record<string, unknown>).id))"
            >
              <UIcon
                :name="campaignForm.targetIds.includes(String((target as Record<string, unknown>).id)) ? 'i-lucide-check-circle' : 'i-lucide-circle'"
                :class="campaignForm.targetIds.includes(String((target as Record<string, unknown>).id)) ? `
                  text-primary
                ` : `text-dimmed`"
                class="size-5 shrink-0"
              />
              <div class="min-w-0">
                <p class="font-medium">
                  {{ (target as Record<string, unknown>).firstName }} {{ (target as Record<string, unknown>).lastName }}
                </p>
                <p class="text-dimmed truncate text-sm">
                  {{ (target as Record<string, unknown>).email }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Review -->
        <div v-if="step === 3" class="flex flex-col gap-3 text-sm">
          <div>
            <p class="text-dimmed">
              Campaign Name
            </p>
            <p class="font-medium">
              {{ campaignForm.name }}
            </p>
          </div>
          <div>
            <p class="text-dimmed">
              Channel
            </p>
            <p class="font-medium capitalize">
              {{ campaignForm.channel }}
            </p>
          </div>
          <div>
            <p class="text-dimmed">
              Template
            </p>
            <p class="font-medium">
              {{ selectedTemplate?.name }}
            </p>
          </div>
          <div>
            <p class="text-dimmed">
              Targets
            </p>
            <p class="font-medium">
              {{ campaignForm.targetIds.length }} employee(s)
            </p>
          </div>
          <div class="bg-accented rounded-md p-3">
            <p class="text-dimmed text-xs">
              The campaign will be created in <strong>draft</strong> status. You can launch it when ready.
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-between">
          <UButton v-if="step > 1" color="neutral" variant="outline" label="Back" @click="prevStep" />
          <div v-else />
          <div class="flex gap-2">
            <UButton color="neutral" variant="outline" label="Cancel" @click="showCreate = false" />
            <UButton v-if="step < 3" label="Next" :disabled="!canNext" @click="nextStep" />
            <UButton v-else label="Create Campaign" :loading="createCampaign.isPending.value" @click="handleCreate" />
          </div>
        </div>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
