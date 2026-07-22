<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const toast = useToast()
const orgId = computed(() => route.params.orgId as string)

const { data: targets, isPending } = useTargetsQuery(orgId)
const { createTarget, deleteTarget } = useTargetMutations()

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

const RE_HTTP_PREFIX = /^https?:\/\//i

function getTargetScrapingStatus(target: Record<string, unknown>): { label: string, color: 'neutral' | 'warning' | 'success' | 'error' } {
  const profiles = target.socialProfiles as Array<{ scrapingStatus: string }> | undefined
  const websiteUrl = target.websiteUrl as string | null | undefined
  const webStatus = (target.websiteScrapingStatus as string | null | undefined) ?? (websiteUrl ? 'pending' : null)

  const statuses: string[] = []
  if (profiles?.length)
    statuses.push(...profiles.map(p => p.scrapingStatus))
  if (websiteUrl)
    statuses.push(webStatus || 'pending')

  if (statuses.length === 0)
    return { label: 'nothing to scrape', color: 'neutral' }
  if (statuses.includes('in_progress'))
    return { label: 'scraping', color: 'warning' }
  if (statuses.includes('pending'))
    return { label: 'pending', color: 'neutral' }
  if (statuses.includes('failed'))
    return { label: 'failed', color: 'error' }
  if (statuses.every(s => s === 'completed'))
    return { label: 'scraped', color: 'success' }
  return { label: 'unknown', color: 'neutral' }
}

// Preview modal
const showPreview = ref(false)
const previewTargetId = ref<string | null>(null)
const _previewTarget = computed(() => {
  if (!previewTargetId.value || !targets.value)
    return null
  return (targets.value as Record<string, unknown>[]).find(t => t.id === previewTargetId.value) ?? null
})
const { data: previewDetail } = useTargetQuery(orgId, computed(() => previewTargetId.value ?? ''))
const { data: previewScraping } = useScrapingResultsQuery(orgId, computed(() => previewTargetId.value ?? ''))

function openPreview(targetId: string) {
  previewTargetId.value = targetId
  showPreview.value = true
}

const platformIcons: Record<string, string> = {
  linkedin: 'i-lucide-linkedin',
  github: 'i-lucide-github',
  twitter: 'i-lucide-twitter',
  facebook: 'i-lucide-facebook',
  instagram: 'i-lucide-instagram',
}

const statusColors: Record<string, 'neutral' | 'warning' | 'success' | 'error'> = {
  pending: 'neutral',
  in_progress: 'warning',
  completed: 'success',
  failed: 'error',
}

const columns: TableColumn<Record<string, unknown>>[] = [
  { accessorKey: 'firstName', header: 'First Name' },
  { accessorKey: 'lastName', header: 'Last Name' },
  { accessorKey: 'email', header: 'Email' },
  {
    id: 'website',
    header: 'Website',
    cell: ({ row }) => {
      const url = (row.original as { websiteUrl?: string | null }).websiteUrl
      if (!url)
        return h('span', { class: 'text-dimmed' }, '—')
      return h('a', {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'text-primary max-w-[140px] truncate inline-block hover:underline',
      }, url.replace(RE_HTTP_PREFIX, ''))
    },
  },
  { accessorKey: 'jobTitle', header: 'Job Title' },
  { accessorKey: 'department', header: 'Department' },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = getTargetScrapingStatus(row.original as Record<string, unknown>)
      return h(UBadge, { color: status.color, variant: 'subtle', size: 'xs', class: 'capitalize' }, () => status.label)
    },
  },
  {
    id: 'actions',
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) => {
      const t = row.original as Record<string, unknown>
      return h('div', { class: 'flex gap-1 justify-end' }, [
        h(UButton, {
          icon: 'i-lucide-eye',
          color: 'neutral',
          variant: 'ghost',
          size: 'xs',
          onClick: () => openPreview(String(t.id)),
        }),
        h(UButton, {
          icon: 'i-lucide-trash-2',
          color: 'error',
          variant: 'ghost',
          size: 'xs',
          onClick: () => handleDelete(String(t.id)),
        }),
      ])
    },
  },
]

async function handleDelete(targetId: string) {
  try {
    await deleteTarget.mutateAsync({ orgId: orgId.value, targetId })
    toast.add({ title: 'Target deleted', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to delete', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

// Create modal
const showCreate = ref(false)
const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  jobTitle: '',
  department: '',
  websiteUrl: '',
  linkedinUrl: '',
  githubUrl: '',
})

async function handleCreate() {
  if (!form.value.firstName || !form.value.lastName || !form.value.email)
    return

  const profiles: { platform: 'linkedin' | 'github', profileUrl: string }[] = []
  if (form.value.linkedinUrl)
    profiles.push({ platform: 'linkedin', profileUrl: form.value.linkedinUrl })
  if (form.value.githubUrl)
    profiles.push({ platform: 'github', profileUrl: form.value.githubUrl })

  try {
    await createTarget.mutateAsync({
      orgId: orgId.value,
      body: {
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        email: form.value.email,
        phoneNumber: form.value.phoneNumber || undefined,
        jobTitle: form.value.jobTitle || undefined,
        department: form.value.department || undefined,
        profiles: profiles.length ? profiles : undefined,
        websiteUrl: form.value.websiteUrl.trim() || undefined,
      },
    })
    toast.add({ title: 'Target created', color: 'success', icon: 'i-lucide-check' })
    form.value = { firstName: '', lastName: '', email: '', phoneNumber: '', jobTitle: '', department: '', websiteUrl: '', linkedinUrl: '', githubUrl: '' }
    showCreate.value = false
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to create target', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

const globalFilter = ref('')
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Targets">
        <template #right>
          <UButton icon="i-lucide-plus" label="Add Target" @click="showCreate = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <div class="p-6">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          Targets
        </h2>
        <UButton icon="i-lucide-plus" label="Add Target" @click="showCreate = true" />
      </div>

      <div v-if="isPending" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
      </div>

      <div v-else-if="!targets?.length" class="py-12 text-center">
        <UIcon
          name="i-lucide-crosshair" class="text-dimmed mx-auto mb-4 size-12"
        />
        <p class="text-lg font-medium">
          No targets yet
        </p>
        <p class="text-dimmed mt-1">
          Add employee targets to start OSINT collection.
        </p>
      </div>

      <template v-else>
        <div class="mb-4 flex">
          <UInput
            v-model="globalFilter" placeholder="Search targets..." icon="i-lucide-search" class="
              max-w-xs
            "
          />
        </div>
        <UTable v-model:global-filter="globalFilter" :data="targets" :columns="columns" />
      </template>
    </div>

    <UModal v-model:open="showCreate" title="Add Employee Target">
      <template #body>
        <div class="flex flex-col gap-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="First Name" required>
              <UInput
                v-model="form.firstName" placeholder="Mario" class="w-full"
              />
            </UFormField>
            <UFormField label="Last Name" required>
              <UInput v-model="form.lastName" placeholder="Rossi" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Email" required>
            <UInput
              v-model="form.email" type="email" placeholder="mario.rossi@acme.it" class="
                w-full
              "
            />
          </UFormField>
          <UFormField label="Phone Number" hint="Required for SMS campaigns">
            <UInput
              v-model="form.phoneNumber" placeholder="+39 333 1234567" class="
                w-full
              "
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Job Title">
              <UInput
                v-model="form.jobTitle" placeholder="IT Manager" class="w-full"
              />
            </UFormField>
            <UFormField label="Department">
              <UInput
                v-model="form.department" placeholder="Infrastructure" class="
                  w-full
                "
              />
            </UFormField>
          </div>
          <UFormField
            label="Website URL" hint="Sito personale: estrazione HTML, link, tecnologie, DNS e WHOIS (task scraping)"
          >
            <UInput
              v-model="form.websiteUrl" type="url" placeholder="https://example.com" class="
                w-full
              "
            />
          </UFormField>
          <USeparator label="Social Profiles" />
          <UFormField label="LinkedIn URL">
            <UInput
              v-model="form.linkedinUrl" placeholder="https://linkedin.com/in/mariorossi" class="
                w-full
              "
            />
          </UFormField>
          <UFormField label="GitHub URL">
            <UInput
              v-model="form.githubUrl" placeholder="https://github.com/mariorossi" class="
                w-full
              "
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" @click="showCreate = false" />
          <UButton label="Add Target" :loading="createTarget.isPending.value" @click="handleCreate" />
        </div>
      </template>
    </UModal>
    <!-- Preview Modal -->
    <UModal v-model:open="showPreview" :title="previewDetail ? `${previewDetail.firstName} ${previewDetail.lastName}` : 'Target'">
      <template #body>
        <div v-if="previewDetail" class="flex flex-col gap-4">
          <!-- Info -->
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-dimmed">
                Email
              </p>
              <p class="font-medium">
                {{ previewDetail.email }}
              </p>
            </div>
            <div>
              <p class="text-dimmed">
                Job Title
              </p>
              <p class="font-medium">
                {{ previewDetail.jobTitle || '-' }}
              </p>
            </div>
            <div>
              <p class="text-dimmed">
                Department
              </p>
              <p class="font-medium">
                {{ previewDetail.department || '-' }}
              </p>
            </div>
            <div v-if="previewDetail.websiteUrl" class="col-span-2">
              <p class="text-dimmed">
                Website
              </p>
              <a
                :href="previewDetail.websiteUrl" target="_blank" rel="noopener noreferrer" class="
                  text-primary font-medium
                  hover:underline
                "
              >{{ previewDetail.websiteUrl }}</a>
              <UBadge
                v-if="previewDetail.websiteScrapingStatus" :color="statusColors[previewDetail.websiteScrapingStatus] || 'neutral'"
                variant="subtle" size="xs" class="ml-2 capitalize"
              >
                {{ String(previewDetail.websiteScrapingStatus).replace('_', ' ') }}
              </UBadge>
            </div>
          </div>

          <!-- Social Profiles -->
          <div v-if="previewDetail.socialProfiles?.length">
            <p class="text-dimmed mb-2 text-xs">
              Social Profiles
            </p>
            <div class="flex flex-col gap-2">
              <div
                v-for="profile in previewDetail.socialProfiles" :key="profile.id" class="
                  flex items-center justify-between text-sm
                "
              >
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="platformIcons[profile.platform] || 'i-lucide-globe'" class="
                      size-4
                    "
                  />
                  <a
                    :href="profile.profileUrl" target="_blank" class="
                      text-primary max-w-xs truncate
                      hover:underline
                    "
                  >{{ profile.profileUrl }}</a>
                </div>
                <UBadge
                  :color="statusColors[profile.scrapingStatus] || 'neutral'" variant="subtle" size="xs" class="
                    capitalize
                  "
                >
                  {{ profile.scrapingStatus.replace('_', ' ') }}
                </UBadge>
              </div>
            </div>
          </div>

          <!-- Latest Scraping Data -->
          <div v-if="previewScraping?.length">
            <p class="text-dimmed mb-2 text-xs">
              Latest Scraping Data
            </p>
            <div v-for="profile in previewScraping" :key="profile.id">
              <div
                v-for="result in profile.scrapingResults?.slice(0, 1)" :key="result.id" class="
                  space-y-1 text-sm
                "
              >
                <div v-if="result.data.platform === 'linkedin'">
                  <p v-if="result.data.headline">
                    <span class="text-dimmed">Headline:</span> {{ result.data.headline }}
                  </p>
                  <p v-if="result.data.location">
                    <span class="text-dimmed">Location:</span> {{ result.data.location }}
                  </p>
                  <div
                    v-if="result.data.skills?.length" class="
                      mt-1 flex flex-wrap gap-1
                    "
                  >
                    <UBadge v-for="skill in result.data.skills" :key="skill" color="neutral" variant="subtle" size="xs">
                      {{ skill }}
                    </UBadge>
                  </div>
                  <div
                    v-if="result.data.activity?.length" class="mt-2 space-y-1"
                  >
                    <p class="text-dimmed text-xs">
                      Post recenti
                    </p>
                    <p
                      v-for="(a, i) in result.data.activity.slice(0, 2)" :key="i" class="
                        line-clamp-2 text-xs
                      "
                    >
                      {{ a.content }}
                    </p>
                  </div>
                </div>
                <div v-else-if="result.data.platform === 'github'">
                  <p v-if="result.data.bio">
                    <span class="text-dimmed">Bio:</span> {{ result.data.bio }}
                  </p>
                  <p><strong>{{ result.data.followers }}</strong> followers</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Close" @click="showPreview = false" />
          <UButton label="Full Details" :to="`/organizations/${orgId}/targets/${previewTargetId}`" @click="showPreview = false" />
        </div>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
