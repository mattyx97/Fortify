<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const toast = useToast()
const orgId = computed(() => route.params.orgId as string)
const targetId = computed(() => route.params.targetId as string)

const { data: target, isPending, refetch } = useTargetQuery(orgId, targetId)
const { data: scrapingResults } = useScrapingResultsQuery(orgId, targetId)
const { triggerScrape } = useTargetMutations()

// ===== EDIT =====
const showEdit = ref(false)
const editForm = ref({ firstName: '', lastName: '', email: '', phoneNumber: '', jobTitle: '', department: '', websiteUrl: '' })

function openEdit() {
  if (!target.value)
    return
  editForm.value = {
    firstName: target.value.firstName,
    lastName: target.value.lastName,
    email: target.value.email,
    phoneNumber: target.value.phoneNumber ?? '',
    jobTitle: target.value.jobTitle ?? '',
    department: target.value.department ?? '',
    websiteUrl: target.value.websiteUrl ?? '',
  }
  showEdit.value = true
}

async function handleEdit() {
  try {
    await $fetch(`/api/organizations/${orgId.value}/targets/${targetId.value}`, {
      method: 'PATCH',
      body: editForm.value,
    })
    toast.add({ title: 'Target updated', color: 'success', icon: 'i-lucide-check' })
    showEdit.value = false
    refetch()
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to update', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

// ===== ADD PROFILE =====
const showAddProfile = ref(false)
const profileForm = ref({ platform: 'linkedin' as const, profileUrl: '' })

const platformOptions = [
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'GitHub', value: 'github' },
  { label: 'Twitter', value: 'twitter' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Instagram', value: 'instagram' },
]

async function handleAddProfile() {
  if (!profileForm.value.profileUrl)
    return
  try {
    await $fetch(`/api/organizations/${orgId.value}/targets/${targetId.value}/profiles`, {
      method: 'POST',
      body: profileForm.value,
    })
    toast.add({ title: 'Profile added', color: 'success', icon: 'i-lucide-check' })
    profileForm.value = { platform: 'linkedin', profileUrl: '' }
    showAddProfile.value = false
    refetch()
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to add profile', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

async function handleRemoveProfile(profileId: string) {
  try {
    await $fetch(`/api/organizations/${orgId.value}/targets/${targetId.value}/profiles/${profileId}`, { method: 'DELETE' })
    toast.add({ title: 'Profile removed', color: 'success', icon: 'i-lucide-check' })
    refetch()
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to remove', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

// ===== SCRAPE =====
async function handleScrape() {
  try {
    await triggerScrape.mutateAsync({ orgId: orgId.value, targetId: targetId.value })
    toast.add({ title: 'Scraping queued', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to trigger scrape', color: 'error', icon: 'i-lucide-circle-x' })
  }
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

const tabs = [
  { label: 'Social Profiles', icon: 'i-lucide-users', slot: 'profiles' as const },
  { label: 'Website', icon: 'i-lucide-scan-search', slot: 'website' as const },
  { label: 'Scraping Results', icon: 'i-lucide-database', slot: 'results' as const },
]

/** Latest website extraction JSON from the server pipeline */
interface WebsiteProfilePayload {
  requestedUrl?: string
  finalUrl?: string
  page?: {
    title?: string | null
    metaDescription?: string | null
    ogTitle?: string | null
    keywords?: string | null
    canonical?: string | null
    contentPreview?: string | null
    headings?: { level: number, text: string }[]
    sections?: { about?: string | null, projects?: string | null, contacts?: string | null }
  }
  links?: Record<string, string[]>
  technologies?: {
    detected?: string[]
    metaGenerator?: string | null
    externalScripts?: string[]
    scriptHosts?: string[]
    stylesheetHosts?: string[]
  }
  infrastructure?: {
    hostname?: string
    responseHeaders?: Record<string, string>
    dns?: { a?: string[], aaaa?: string[], ns?: string[], txt?: string[] }
    whois?: Record<string, unknown> | null
    whoisError?: string | null
  }
}

const siteData = computed(() => (target.value?.websiteProfileData ?? null) as WebsiteProfilePayload | null)

const showFullSiteText = ref(false)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" :to="`/organizations/${orgId}/targets`" />
        </template>
        <template #title>
          <span v-if="target">{{ target.firstName }} {{ target.lastName }}</span>
        </template>
        <template #right>
          <div class="flex gap-2">
            <UButton icon="i-lucide-pencil" label="Edit" color="neutral" variant="outline" @click="openEdit" />
            <UButton icon="i-lucide-radar" label="Scrape" :loading="triggerScrape.isPending.value" @click="handleScrape" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <div v-if="isPending" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
    </div>

    <div v-else-if="target" class="flex-1 overflow-y-auto p-6">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" :to="`/organizations/${orgId}/targets`" />
          <h2 class="text-lg font-semibold">
            {{ target.firstName }} {{ target.lastName }}
          </h2>
        </div>
        <div class="flex gap-2">
          <UButton icon="i-lucide-pencil" label="Edit" color="neutral" variant="outline" @click="openEdit" />
          <UButton icon="i-lucide-radar" label="Scrape" :loading="triggerScrape.isPending.value" @click="handleScrape" />
        </div>
      </div>
      <!-- Target Info -->
      <UCard class="mb-6">
        <div
          class="
            grid grid-cols-2 gap-4
            md:grid-cols-4
          "
        >
          <div>
            <p class="text-dimmed text-xs">
              Email
            </p>
            <p class="font-medium">
              {{ target.email }}
            </p>
          </div>
          <div>
            <p class="text-dimmed text-xs">
              Job Title
            </p>
            <p class="font-medium">
              {{ target.jobTitle || '-' }}
            </p>
          </div>
          <div>
            <p class="text-dimmed text-xs">
              Department
            </p>
            <p class="font-medium">
              {{ target.department || '-' }}
            </p>
          </div>
          <div>
            <p class="text-dimmed text-xs">
              Profiles
            </p>
            <p class="font-medium">
              {{ target.socialProfiles?.length || 0 }}
            </p>
          </div>
          <div
            class="
              col-span-2
              md:col-span-4
            "
          >
            <p class="text-dimmed text-xs">
              Website
            </p>
            <template v-if="target.websiteUrl">
              <a
                :href="target.websiteUrl" target="_blank" rel="noopener noreferrer" class="
                  text-primary font-medium
                  hover:underline
                "
              >{{ target.websiteUrl }}</a>
              <UBadge
                v-if="target.websiteScrapingStatus" :color="statusColors[target.websiteScrapingStatus] || 'neutral'"
                variant="subtle" size="xs" class="ml-2 capitalize"
              >
                {{ target.websiteScrapingStatus.replace('_', ' ') }}
              </UBadge>
            </template>
            <p v-else class="font-medium">
              —
            </p>
          </div>
        </div>
      </UCard>

      <UTabs :items="tabs" class="w-full">
        <!-- Social Profiles -->
        <template #profiles>
          <div class="mt-4">
            <div class="mb-3 flex justify-end">
              <UButton icon="i-lucide-plus" label="Add Profile" size="sm" variant="outline" @click="() => { showAddProfile = true }" />
            </div>
            <div v-if="!target.socialProfiles?.length" class="py-8 text-center">
              <p class="text-dimmed">
                No social profiles linked.
              </p>
            </div>
            <div v-else class="grid gap-3">
              <UCard v-for="profile in target.socialProfiles" :key="profile.id">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <UIcon
                      :name="platformIcons[profile.platform] || 'i-lucide-globe'" class="
                        size-5
                      "
                    />
                    <div>
                      <p class="font-medium capitalize">
                        {{ profile.platform }}
                      </p>
                      <a
                        :href="profile.profileUrl" target="_blank" class="
                          text-primary text-sm
                          hover:underline
                        "
                      >{{ profile.profileUrl }}</a>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <UBadge
                      :color="statusColors[profile.scrapingStatus] || 'neutral'" variant="subtle" class="
                        capitalize
                      "
                    >
                      {{ profile.scrapingStatus.replace('_', ' ') }}
                    </UBadge>
                    <span
                      v-if="profile.lastScrapedAt" class="text-dimmed text-xs"
                    >
                      {{ new Date(profile.lastScrapedAt).toLocaleDateString() }}
                    </span>
                    <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="handleRemoveProfile(profile.id)" />
                  </div>
                </div>
              </UCard>
            </div>
          </div>
        </template>

        <template #website>
          <div class="mt-4 space-y-4">
            <div v-if="!target.websiteUrl" class="text-dimmed py-8 text-center">
              Nessun sito configurato. Modifica il target e aggiungi un URL, poi usa Scrape (task server).
            </div>
            <template v-else>
              <div class="flex flex-wrap items-center gap-2">
                <a
                  :href="target.websiteUrl" target="_blank" rel="noopener noreferrer" class="
                    text-primary text-sm
                    hover:underline
                  "
                >{{ target.websiteUrl }}</a>
                <UBadge
                  v-if="target.websiteScrapingStatus" :color="statusColors[target.websiteScrapingStatus] || 'neutral'"
                  variant="subtle" class="capitalize"
                >
                  {{ target.websiteScrapingStatus.replace('_', ' ') }}
                </UBadge>
                <span
                  v-if="target.websiteLastScrapedAt" class="text-dimmed text-xs"
                >
                  Ultimo scrape: {{ new Date(target.websiteLastScrapedAt).toLocaleString() }}
                </span>
              </div>

              <div
                v-if="target.websiteScrapingStatus === 'completed' && siteData" class="
                  space-y-4
                "
              >
                <!-- Contenuto e metadati estratti dalla pagina -->
                <UCard>
                  <template #header>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-file-text" class="size-4" />
                      <span class="font-medium">Informazioni estratte</span>
                    </div>
                  </template>
                  <div class="space-y-4 text-sm">
                    <div
                      v-if="siteData.requestedUrl || siteData.finalUrl" class="
                        space-y-1
                      "
                    >
                      <p
                        v-if="siteData.requestedUrl" class="text-dimmed text-xs"
                      >
                        URL richiesto
                      </p>
                      <p
                        v-if="siteData.requestedUrl" class="
                          font-mono text-xs break-all
                        "
                      >
                        {{ siteData.requestedUrl }}
                      </p>
                      <template v-if="siteData.finalUrl && siteData.finalUrl !== siteData.requestedUrl">
                        <p class="text-dimmed text-xs">
                          URL finale (redirect)
                        </p>
                        <p class="font-mono text-xs break-all">
                          {{ siteData.finalUrl }}
                        </p>
                      </template>
                    </div>

                    <div v-if="siteData.page?.title || siteData.page?.ogTitle">
                      <p class="text-dimmed mb-0.5 text-xs">
                        Titolo pagina
                      </p>
                      <p class="font-medium">
                        {{ siteData.page?.title || '—' }}
                      </p>
                      <p
                        v-if="siteData.page?.ogTitle && siteData.page.ogTitle !== siteData.page?.title" class="
                          text-dimmed mt-1 text-xs
                        "
                      >
                        <span class="text-default font-medium">og:title</span>: {{ siteData.page.ogTitle }}
                      </p>
                    </div>

                    <div v-if="siteData.page?.metaDescription">
                      <p class="text-dimmed mb-0.5 text-xs">
                        Meta description
                      </p>
                      <p class="text-dimmed leading-relaxed">
                        {{ siteData.page.metaDescription }}
                      </p>
                    </div>

                    <div v-if="siteData.page?.keywords" class="text-xs">
                      <p class="text-dimmed mb-0.5">
                        Keywords
                      </p>
                      <p class="wrap-break-word">
                        {{ siteData.page.keywords }}
                      </p>
                    </div>

                    <div v-if="siteData.page?.canonical">
                      <p class="text-dimmed mb-0.5 text-xs">
                        Canonical
                      </p>
                      <a
                        :href="siteData.page.canonical" class="
                          text-primary text-xs break-all
                          hover:underline
                        "
                        target="_blank" rel="noopener noreferrer"
                      >{{ siteData.page.canonical }}</a>
                    </div>

                    <template v-if="siteData.page?.sections">
                      <USeparator v-if="siteData.page.sections.about || siteData.page.sections.projects || siteData.page.sections.contacts" />
                      <div v-if="siteData.page.sections.about" class="space-y-1">
                        <p class="text-dimmed text-xs font-medium">
                          Sezione About
                        </p>
                        <p class="leading-relaxed whitespace-pre-wrap">
                          {{ siteData.page.sections.about }}
                        </p>
                      </div>
                      <div
                        v-if="siteData.page.sections.projects" class="space-y-1"
                      >
                        <p class="text-dimmed text-xs font-medium">
                          Progetti
                        </p>
                        <p class="leading-relaxed whitespace-pre-wrap">
                          {{ siteData.page.sections.projects }}
                        </p>
                      </div>
                      <div
                        v-if="siteData.page.sections.contacts" class="space-y-1"
                      >
                        <p class="text-dimmed text-xs font-medium">
                          Contatti
                        </p>
                        <p class="leading-relaxed whitespace-pre-wrap">
                          {{ siteData.page.sections.contacts }}
                        </p>
                      </div>
                    </template>

                    <div v-if="siteData.page?.contentPreview">
                      <USeparator />
                      <p class="text-dimmed mb-2 text-xs font-medium">
                        Anteprima testo visibile (main / article / body)
                      </p>
                      <p
                        class="text-dimmed leading-relaxed whitespace-pre-wrap"
                        :class="showFullSiteText ? '' : 'line-clamp-6'"
                      >
                        {{ siteData.page.contentPreview }}
                      </p>
                      <UButton
                        v-if="(siteData.page.contentPreview?.length || 0) > 280" size="xs" variant="link" class="
                          mt-1 px-0
                        "
                        :label="showFullSiteText ? 'Mostra meno' : 'Mostra tutto il testo'" @click="() => { showFullSiteText = !showFullSiteText }"
                      />
                    </div>

                    <div v-if="siteData.page?.headings?.length">
                      <USeparator />
                      <p class="text-dimmed mb-2 text-xs font-medium">
                        Heading (H1–H6)
                      </p>
                      <ul
                        class="
                          max-h-48 list-inside list-disc space-y-0.5
                          overflow-y-auto text-sm
                        "
                      >
                        <li v-for="(h, i) in siteData.page.headings" :key="i">
                          <span class="text-dimmed">H{{ h.level }}</span> {{ h.text }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </UCard>

                <UCard v-if="siteData.links && Object.keys(siteData.links).length">
                  <p class="mb-2 text-sm font-medium">
                    Link rilevati
                  </p>
                  <div class="flex flex-col gap-2 text-sm">
                    <template v-for="(urls, key) in siteData.links" :key="key">
                      <div v-if="Array.isArray(urls) && urls.length">
                        <span class="text-dimmed capitalize">{{ key }}</span>
                        <ul class="mt-1 space-y-0.5">
                          <li
                            v-for="(u, i) in urls.slice(0, 8)" :key="i" class="
                              truncate
                            "
                          >
                            <a
                              v-if="u.startsWith('http') || u.startsWith('mailto')" :href="u" class="
                                text-primary
                                hover:underline
                              " target="_blank"
                            >{{ u }}</a>
                            <span v-else>{{ u }}</span>
                          </li>
                        </ul>
                      </div>
                    </template>
                  </div>
                </UCard>

                <UCard v-if="siteData.technologies?.detected?.length">
                  <p class="mb-2 text-sm font-medium">
                    Tecnologie (euristiche)
                  </p>
                  <div class="flex flex-wrap gap-1">
                    <UBadge v-for="t in siteData.technologies.detected" :key="t" color="neutral" variant="subtle" size="xs">
                      {{ t }}
                    </UBadge>
                  </div>
                  <p
                    v-if="siteData.technologies.metaGenerator" class="
                      text-dimmed mt-2 text-xs
                    "
                  >
                    Generator: {{ siteData.technologies.metaGenerator }}
                  </p>
                  <div
                    v-if="siteData.technologies.scriptHosts?.length" class="
                      mt-3
                    "
                  >
                    <p class="text-dimmed mb-1 text-xs">
                      Host script esterni
                    </p>
                    <p class="font-mono text-xs wrap-break-word">
                      {{ siteData.technologies.scriptHosts.join(', ') }}
                    </p>
                  </div>
                </UCard>

                <UCard v-if="siteData.infrastructure?.hostname">
                  <template #header>
                    <span class="font-medium">Infrastruttura</span>
                  </template>
                  <div class="space-y-3 text-sm">
                    <p>
                      <span class="text-dimmed">Host</span> {{ siteData.infrastructure.hostname }}
                    </p>
                    <p v-if="siteData.infrastructure.responseHeaders?.server">
                      <span class="text-dimmed">Server</span>
                      {{ siteData.infrastructure.responseHeaders.server }}
                    </p>
                    <div v-if="siteData.infrastructure.dns?.a?.length">
                      <p class="text-dimmed mb-0.5 text-xs">
                        DNS A
                      </p>
                      <p class="font-mono text-xs">
                        {{ siteData.infrastructure.dns.a.join(', ') }}
                      </p>
                    </div>
                    <div v-if="siteData.infrastructure.dns?.ns?.length">
                      <p class="text-dimmed mb-0.5 text-xs">
                        Nameserver
                      </p>
                      <p class="font-mono text-xs">
                        {{ siteData.infrastructure.dns.ns.join(', ') }}
                      </p>
                    </div>
                    <p
                      v-if="siteData.infrastructure.whoisError" class="
                        text-dimmed text-xs
                      "
                    >
                      WHOIS: {{ siteData.infrastructure.whoisError }}
                    </p>
                    <p
                      v-else-if="siteData.infrastructure.whois && Object.keys(siteData.infrastructure.whois).length"
                      class="text-dimmed text-xs"
                    >
                      Dati WHOIS salvati nel JSON (dettaglio nel export / API).
                    </p>
                  </div>
                </UCard>
              </div>

              <p
                v-else-if="target.websiteScrapingStatus === 'pending' || target.websiteScrapingStatus === 'in_progress'"
                class="text-dimmed text-sm"
              >
                In coda per estrazione (fetch HTML, DNS, WHOIS). Esegui il task <code
                  class="bg-elevated rounded-sm px-1"
                >scraping:process</code> o attendi lo scheduler.
              </p>
              <p
                v-else-if="target.websiteScrapingStatus === 'failed'" class="
                  text-error text-sm
                "
              >
                Ultimo tentativo fallito. Riavvia lo scrape dalla toolbar.
              </p>
            </template>
          </div>
        </template>

        <!-- Scraping Results -->
        <template #results>
          <div class="mt-4">
            <div v-if="!scrapingResults?.length" class="py-8 text-center">
              <p class="text-dimmed">
                No scraping results yet.
              </p>
            </div>
            <div v-else class="flex flex-col gap-4">
              <UCard v-for="profile in scrapingResults" :key="profile.id">
                <template #header>
                  <div class="flex items-center gap-2">
                    <UIcon
                      :name="platformIcons[profile.platform] || 'i-lucide-globe'" class="
                        size-4
                      "
                    />
                    <span class="font-medium capitalize">{{ profile.platform }}</span>
                  </div>
                </template>

                <div
                  v-if="!profile.scrapingResults?.length" class="
                    text-dimmed text-sm
                  "
                >
                  No results.
                </div>

                <div
                  v-for="result in profile.scrapingResults" :key="result.id" class="
                    mb-4
                    last:mb-0
                  "
                >
                  <p class="text-dimmed mb-2 text-xs">
                    Scraped {{ new Date(result.scrapedAt).toLocaleString() }}
                  </p>

                  <!-- LinkedIn -->
                  <div
                    v-if="result.data.platform === 'linkedin'" class="
                      space-y-2 text-sm
                    "
                  >
                    <p v-if="result.data.headline">
                      <span class="text-dimmed">Headline:</span> {{ result.data.headline }}
                    </p>
                    <p v-if="result.data.location">
                      <span class="text-dimmed">Location:</span> {{ result.data.location }}
                    </p>
                    <p v-if="result.data.bio" class="line-clamp-3">
                      <span
                        class="text-dimmed"
                      >Bio:</span> {{ result.data.bio }}
                    </p>
                    <div v-if="result.data.experiences?.length">
                      <p class="text-dimmed mb-1 text-xs">
                        Experiences
                      </p>
                      <p v-for="exp in result.data.experiences" :key="exp.title">
                        <strong>{{ exp.title }}</strong> @ {{ exp.company }} <span
                          class="text-dimmed"
                        >— {{ exp.duration }}</span>
                      </p>
                    </div>
                    <div v-if="result.data.education?.length">
                      <p class="text-dimmed mb-1 text-xs">
                        Education
                      </p>
                      <p v-for="edu in result.data.education" :key="edu.school">
                        <strong>{{ edu.school }}</strong><span
                          v-if="edu.degree" class="text-dimmed"
                        > — {{ edu.degree }}</span>
                      </p>
                    </div>
                    <div v-if="result.data.skills?.length">
                      <p class="text-dimmed mb-1 text-xs">
                        Skills
                      </p>
                      <div class="flex flex-wrap gap-1">
                        <UBadge v-for="skill in result.data.skills" :key="skill" color="neutral" variant="subtle" size="xs">
                          {{ skill }}
                        </UBadge>
                      </div>
                    </div>
                    <div v-if="result.data.projects?.length">
                      <p class="text-dimmed mb-1 text-xs">
                        Progetti
                      </p>
                      <p v-for="proj in result.data.projects" :key="proj.name">
                        <strong>{{ proj.name }}</strong><span
                          v-if="proj.description" class="text-dimmed"
                        > — {{ proj.description }}</span>
                      </p>
                    </div>
                    <div v-if="result.data.certifications?.length">
                      <p class="text-dimmed mb-1 text-xs">
                        Licenze e certificazioni
                      </p>
                      <div class="flex flex-wrap gap-1">
                        <UBadge v-for="cert in result.data.certifications" :key="cert" color="neutral" variant="subtle" size="xs">
                          {{ cert }}
                        </UBadge>
                      </div>
                    </div>
                    <div
                      v-if="result.data.activity?.length" class="
                        border-default mt-3 border-t pt-3
                      "
                    >
                      <p class="text-dimmed mb-2 text-xs font-medium">
                        Post e attività recenti (da /recent-activity/)
                      </p>
                      <ul class="space-y-3">
                        <li
                          v-for="(item, ai) in result.data.activity" :key="ai" class="
                            bg-elevated/50 rounded-md p-3 text-sm
                          "
                        >
                          <div class="mb-1 flex flex-wrap items-center gap-2">
                            <UBadge
                              :color="item.type === 'post' ? 'primary' : 'neutral'" variant="subtle" size="xs"
                              class="capitalize"
                            >
                              {{ item.type === 'post' ? 'Post' : 'Condivisione' }}
                            </UBadge>
                            <span
                              v-if="item.relativeTime" class="
                                text-dimmed text-xs
                              "
                            >{{ item.relativeTime }}</span>
                            <span
                              v-if="item.originalAuthor" class="
                                text-dimmed text-xs
                              "
                            >di {{ item.originalAuthor }}</span>
                          </div>
                          <p class="leading-relaxed whitespace-pre-wrap">
                            {{ item.content }}
                          </p>
                        </li>
                      </ul>
                    </div>
                    <p
                      v-if="Array.isArray(result.data.activity) && result.data.activity.length === 0"
                      class="text-dimmed mt-2 text-xs"
                    >
                      Nessun post estratto dalla pagina attività (DOM LinkedIn, sessione o feed vuoto).
                    </p>
                  </div>

                  <!-- GitHub -->
                  <div
                    v-else-if="result.data.platform === 'github'" class="
                      space-y-2 text-sm
                    "
                  >
                    <p v-if="result.data.bio">
                      <span class="text-dimmed">Bio:</span> {{ result.data.bio }}
                    </p>
                    <p><strong>{{ result.data.followers }}</strong> followers · <strong>{{ result.data.following }}</strong> following</p>
                    <div v-if="result.data.repositories?.length">
                      <p class="text-dimmed mb-2 text-xs font-medium">
                        Repositori pubblici (README e contributori se la pagina è accessibile)
                      </p>
                      <div class="space-y-3">
                        <div
                          v-for="repo in result.data.repositories" :key="repo.url || repo.name" class="
                            bg-elevated/40 border-default rounded-lg border p-3
                          "
                        >
                          <div class="flex flex-wrap items-center gap-2">
                            <UIcon
                              name="i-lucide-git-branch" class="size-3 shrink-0"
                            />
                            <a
                              :href="repo.url" target="_blank" rel="noopener noreferrer" class="
                                text-primary font-medium
                                hover:underline
                              "
                            >{{ repo.name }}</a>
                            <UBadge v-if="repo.language" color="neutral" variant="subtle" size="xs">
                              {{ repo.language }}
                            </UBadge>
                            <span class="text-dimmed text-xs">{{ repo.stars }} ★ · {{ repo.forks }} forks</span>
                          </div>
                          <p
                            v-if="repo.description" class="
                              text-dimmed mt-1 text-xs
                            "
                          >
                            {{ repo.description }}
                          </p>
                          <div v-if="repo.readmePreview" class="mt-2">
                            <p class="text-dimmed mb-0.5 text-xs">
                              README
                            </p>
                            <p
                              class="
                                max-h-40 overflow-y-auto text-xs/relaxed
                                whitespace-pre-wrap
                              "
                            >
                              {{ repo.readmePreview }}
                            </p>
                          </div>
                          <div v-if="repo.contributors?.length" class="mt-2">
                            <p class="text-dimmed mb-1 text-xs">
                              Contributori
                            </p>
                            <div class="flex flex-wrap gap-1">
                              <a
                                v-for="c in repo.contributors" :key="c.login" :href="c.profileUrl"
                                target="_blank" rel="noopener noreferrer"
                              >
                                <UBadge
                                  color="neutral" variant="subtle" size="xs" class="
                                    hover:bg-elevated
                                  "
                                >
                                  @{{ c.login }}
                                </UBadge>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </UCard>
            </div>
          </div>
        </template>
      </UTabs>
    </div>

    <!-- Edit Modal -->
    <UModal v-model:open="showEdit" title="Edit Target">
      <template #body>
        <div class="flex flex-col gap-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="First Name">
              <UInput v-model="editForm.firstName" class="w-full" />
            </UFormField>
            <UFormField label="Last Name">
              <UInput v-model="editForm.lastName" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Email">
            <UInput v-model="editForm.email" type="email" class="w-full" />
          </UFormField>
          <UFormField label="Phone Number" hint="Required for SMS">
            <UInput v-model="editForm.phoneNumber" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Job Title">
              <UInput v-model="editForm.jobTitle" class="w-full" />
            </UFormField>
            <UFormField label="Department">
              <UInput v-model="editForm.department" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Website URL" hint="Estrazione lato server (HTML, link, DNS, WHOIS)">
            <UInput
              v-model="editForm.websiteUrl" type="url" placeholder="https://..." class="
                w-full
              "
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" @click="() => { showEdit = false }" />
          <UButton label="Save" @click="handleEdit" />
        </div>
      </template>
    </UModal>

    <!-- Add Profile Modal -->
    <UModal v-model:open="showAddProfile" title="Add Social Profile">
      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField label="Platform">
            <USelect
              v-model="profileForm.platform" :items="platformOptions" class="
                w-full
              "
            />
          </UFormField>
          <UFormField label="Profile URL">
            <UInput
              v-model="profileForm.profileUrl" placeholder="https://..." class="
                w-full
              "
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" @click="() => { showAddProfile = false }" />
          <UButton label="Add" @click="handleAddProfile" />
        </div>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
