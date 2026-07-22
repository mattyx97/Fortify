<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const toast = useToast()
const orgId = computed(() => route.params.orgId as string)
const campaignId = computed(() => route.params.campaignId as string)

const { data: campaign, isPending } = useCampaignQuery(orgId, campaignId)
const { data: interactions } = useCampaignInteractionsQuery(orgId, campaignId)
const { updateCampaignStatus } = useCampaignMutations()

const statusColors: Record<string, 'neutral' | 'warning' | 'success'> = {
  draft: 'neutral',
  active: 'warning',
  completed: 'success',
}

const channelIcons: Record<string, string> = {
  email: 'i-lucide-mail',
  sms: 'i-lucide-message-square',
}

// Fixed locale so the server (Node) and the client render identical text and Vue
// hydration doesn't mismatch on locale-dependent date formatting.
function formatDateTime(d: string | number | Date) {
  return new Date(d).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium' })
}

async function handleLaunch() {
  try {
    await updateCampaignStatus.mutateAsync({ orgId: orgId.value, campaignId: campaignId.value, status: 'active' })
    toast.add({ title: 'Campaign launched', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

async function handleComplete() {
  try {
    await updateCampaignStatus.mutateAsync({ orgId: orgId.value, campaignId: campaignId.value, status: 'completed' })
    toast.add({ title: 'Campaign completed', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

// Detail modal
const showDetail = ref(false)
const detailInteraction = ref<Record<string, unknown> | null>(null)
const detailTarget = ref<Record<string, unknown> | null>(null)

function openDetail(interaction: Record<string, unknown>, target: Record<string, unknown> | null) {
  detailInteraction.value = interaction
  detailTarget.value = target
  showDetail.value = true
}

const eventIcons: Record<string, string> = {
  email_opened: 'i-lucide-eye',
  link_clicked: 'i-lucide-mouse-pointer-click',
  form_submitted: 'i-lucide-file-input',
  payload_executed: 'i-lucide-bug',
}

const eventColors: Record<string, 'neutral' | 'warning' | 'error' | 'success' | 'primary'> = {
  email_opened: 'neutral',
  link_clicked: 'warning',
  form_submitted: 'error',
  payload_executed: 'error',
}

// Aggregate stats
const stats = computed(() => {
  if (!interactions.value)
    return null
  const total = interactions.value.length
  const sent = interactions.value.filter(ct => ct.sentAt).length
  const opened = interactions.value.filter(ct => ct.interactions?.some(i => i.eventType === 'email_opened')).length
  const clicked = interactions.value.filter(ct => ct.interactions?.some(i => i.eventType === 'link_clicked')).length
  const submitted = interactions.value.filter(ct => ct.interactions?.some(i => i.eventType === 'form_submitted')).length
  const executed = interactions.value.filter(ct => ct.interactions?.some(i => i.eventType === 'payload_executed')).length

  return { total, sent, opened, clicked, submitted, executed }
})

// ============ RISK REPORT (HTML/PDF export — component #6) ============

type Ct = NonNullable<typeof interactions.value>[number]

function eventsOf(ct: Ct): Set<string> {
  return new Set((ct.interactions || []).map(i => i.eventType))
}

function riskOf(ct: Ct): { label: string, rank: number } {
  const ev = eventsOf(ct)
  if (ev.has('form_submitted') || ev.has('payload_executed'))
    return { label: 'Critical', rank: 4 }
  if (ev.has('link_clicked'))
    return { label: 'High', rank: 3 }
  if (ev.has('email_opened'))
    return { label: 'Medium', rank: 2 }
  return { label: 'Low', rank: 1 }
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] || c))
}

function buildRecommendations(pct: { opened: number, clicked: number, submitted: number }): string[] {
  const recs: string[] = []
  if (pct.submitted >= 20)
    recs.push('High credential-submission rate: run mandatory credential-handling and MFA training; consider phishing-resistant authentication (passkeys/FIDO2).')
  else if (pct.submitted > 0)
    recs.push('Some users submitted credentials on a simulated login page: deliver targeted just-in-time coaching to those individuals.')
  if (pct.clicked >= 40)
    recs.push('High click-through rate: reinforce link-hygiene (hover-to-inspect, report-phish button) and increase simulation frequency.')
  else if (pct.clicked > 0)
    recs.push('Reinforce how to verify sender identity and inspect links before clicking.')
  if (pct.opened >= 60)
    recs.push('Most targets opened the message: review email-gateway filtering and sender-authentication (SPF/DKIM/DMARC).')
  if (!recs.length)
    recs.push('Low engagement across the board — maintain current awareness cadence and re-test with a different pretext to confirm resilience.')
  recs.push('Recognise and reward users who reported the simulation instead of interacting with it.')
  return recs
}

function downloadReport() {
  const c = campaign.value
  const s = stats.value
  if (!c || !s || !interactions.value)
    return

  const total = s.total || 1
  const pct = {
    opened: Math.round((s.opened / total) * 100),
    clicked: Math.round((s.clicked / total) * 100),
    submitted: Math.round((s.submitted / total) * 100),
  }
  // Composite susceptibility score (0-100): weighted by severity of the deepest action.
  const riskScore = Math.min(100, Math.round(0.2 * pct.opened + 0.35 * pct.clicked + 0.45 * pct.submitted))
  const riskBand = riskScore >= 60 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW'

  // Per-department rollup
  const byDept = new Map<string, { total: number, opened: number, clicked: number, submitted: number }>()
  for (const ct of interactions.value) {
    const dept = ct.target?.department || 'Unassigned'
    const row = byDept.get(dept) || { total: 0, opened: 0, clicked: 0, submitted: 0 }
    const ev = eventsOf(ct)
    row.total++
    if (ev.has('email_opened')) row.opened++
    if (ev.has('link_clicked')) row.clicked++
    if (ev.has('form_submitted')) row.submitted++
    byDept.set(dept, row)
  }

  // High-risk individuals, most severe first
  const ranked = [...interactions.value]
    .map(ct => ({ ct, risk: riskOf(ct) }))
    .sort((a, b) => b.risk.rank - a.risk.rank)

  // Flat, time-ordered event timeline
  const timeline = interactions.value
    .flatMap(ct => (ct.interactions || []).map(i => ({
      when: i.createdAt as string,
      who: `${ct.target?.firstName ?? ''} ${ct.target?.lastName ?? ''}`.trim() || (ct.target?.email ?? '—'),
      event: i.eventType.replace(/_/g, ' '),
    })))
    .sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())

  const recs = buildRecommendations(pct)
  const generatedAt = formatDateTime(new Date())
  const bandColor = riskBand === 'HIGH' ? '#dc2626' : riskBand === 'MEDIUM' ? '#d97706' : '#16a34a'

  const metric = (label: string, value: string | number, sub = '') =>
    `<div class="metric"><div class="mv">${esc(value)}</div><div class="ml">${esc(label)}</div>${sub ? `<div class="ms">${esc(sub)}</div>` : ''}</div>`

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Risk Report — ${esc(c.name)}</title>
<style>
  :root{--ink:#0f172a;--dim:#64748b;--line:#e2e8f0;--band:${bandColor}}
  *{box-sizing:border-box}body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);margin:0;padding:40px;max-width:900px;margin-inline:auto}
  h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--line)}
  .sub{color:var(--dim);margin:0 0 24px}
  .band{display:inline-block;padding:4px 12px;border-radius:999px;background:var(--band);color:#fff;font-weight:700;font-size:12px;letter-spacing:.05em}
  .score{display:flex;align-items:center;gap:20px;background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:20px;margin:8px 0 8px}
  .score .big{font-size:44px;font-weight:800;color:var(--band);line-height:1}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:8px 0}
  .metric{border:1px solid var(--line);border-radius:10px;padding:14px}
  .mv{font-size:22px;font-weight:700}.ml{color:var(--dim);font-size:12px;text-transform:uppercase;letter-spacing:.04em}.ms{color:var(--dim);font-size:12px;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin:8px 0}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);font-size:13px}
  th{color:var(--dim);text-transform:uppercase;font-size:11px;letter-spacing:.04em}
  .pill{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
  .Critical{background:#fee2e2;color:#b91c1c}.High{background:#fef3c7;color:#b45309}.Medium{background:#e0e7ff;color:#3730a3}.Low{background:#dcfce7;color:#166534}
  ul{margin:8px 0;padding-left:20px}li{margin:6px 0}
  .foot{margin-top:40px;color:var(--dim);font-size:12px;border-top:1px solid var(--line);padding-top:12px}
  @media print{body{padding:0}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body>
<h1>Social Engineering Risk Report</h1>
<p class="sub">Campaign: <strong>${esc(c.name)}</strong> · Channel: ${esc(c.channel)} · Status: ${esc(c.status)} · Generated ${esc(generatedAt)}</p>

<h2>Executive Summary</h2>
<div class="score">
  <div><div class="big">${riskScore}<span style="font-size:20px">/100</span></div></div>
  <div>
    <div class="band">${riskBand} SUSCEPTIBILITY</div>
    <p style="margin:8px 0 0;color:var(--dim)">Composite score weighted by the deepest action each target took (opened → clicked → submitted credentials). ${s.submitted} of ${s.total} target(s) submitted credentials to a simulated login page.</p>
  </div>
</div>
<div class="grid">
  ${metric('Targets', s.total)}
  ${metric('Delivered', `${s.sent}/${s.total}`)}
  ${metric('Opened', s.opened, `${pct.opened}%`)}
  ${metric('Clicked (CTR)', s.clicked, `${pct.clicked}%`)}
  ${metric('Submitted', s.submitted, `${pct.submitted}%`)}
  ${metric('Payload exec', s.executed)}
  ${metric('Submission rate', `${s.clicked ? Math.round((s.submitted / s.clicked) * 100) : 0}%`, 'of clickers')}
  ${metric('Reported', '—', 'not tracked')}
</div>

<h2>Vulnerability by Department</h2>
<table><thead><tr><th>Department</th><th>Targets</th><th>Opened</th><th>Clicked</th><th>Submitted</th></tr></thead><tbody>
${[...byDept.entries()].map(([d, r]) => `<tr><td>${esc(d)}</td><td>${r.total}</td><td>${r.opened}</td><td>${r.clicked}</td><td>${r.submitted}</td></tr>`).join('')}
</tbody></table>

<h2>High-Risk Individuals</h2>
<table><thead><tr><th>Risk</th><th>Name</th><th>Email</th><th>Role</th><th>Department</th></tr></thead><tbody>
${ranked.map(({ ct, risk }) => `<tr><td><span class="pill ${risk.label}">${risk.label}</span></td><td>${esc(`${ct.target?.firstName ?? ''} ${ct.target?.lastName ?? ''}`.trim())}</td><td>${esc(ct.target?.email)}</td><td>${esc(ct.target?.jobTitle || '—')}</td><td>${esc(ct.target?.department || '—')}</td></tr>`).join('')}
</tbody></table>

<h2>Event Timeline</h2>
<table><thead><tr><th>Time</th><th>Target</th><th>Event</th></tr></thead><tbody>
${timeline.length ? timeline.map(t => `<tr><td>${esc(formatDateTime(t.when))}</td><td>${esc(t.who)}</td><td>${esc(t.event)}</td></tr>`).join('') : '<tr><td colspan="3" style="color:#64748b">No interactions recorded yet.</td></tr>'}
</tbody></table>

<h2>Training Recommendations</h2>
<ul>${recs.map(r => `<li>${esc(r)}</li>`).join('')}</ul>

<p class="foot">Generated by Fortify — AI-Powered Social Engineering Simulation Framework. This report documents an authorized, controlled security-awareness exercise. Captured credentials are simulated and are shown only for remediation purposes.</p>
</body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar />
    </template>

    <div v-if="isPending" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
    </div>

    <div v-else-if="campaign" class="flex-1 overflow-y-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" :to="`/organizations/${orgId}/campaigns`" />
          <div>
            <h2 class="text-lg font-semibold">
              {{ campaign.name }}
            </h2>
            <p v-if="campaign.description" class="text-dimmed text-sm">
              {{ campaign.description }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UBadge
            :color="statusColors[campaign.status]" variant="subtle" size="md" class="
              capitalize
            "
          >
            {{ campaign.status }}
          </UBadge>
          <UButton v-if="campaign.status !== 'draft'" icon="i-lucide-file-text" label="Report" color="neutral" variant="outline" @click="downloadReport" />
          <UButton v-if="campaign.status === 'draft'" icon="i-lucide-play" label="Launch" color="success" @click="handleLaunch" />
          <UButton v-if="campaign.status === 'active'" icon="i-lucide-check-circle" label="Complete" @click="handleComplete" />
        </div>
      </div>

      <!-- Campaign Info -->
      <div
        class="
          mb-6 grid grid-cols-2 gap-4
          md:grid-cols-4
        "
      >
        <UCard>
          <p class="text-dimmed text-xs">
            Channel
          </p>
          <div class="mt-1 flex items-center gap-1.5">
            <UIcon :name="channelIcons[campaign.channel]" class="size-4" />
            <p class="font-medium capitalize">
              {{ campaign.channel }}
            </p>
          </div>
        </UCard>
        <UCard>
          <p class="text-dimmed text-xs">
            Template
          </p>
          <p class="mt-1 font-medium">
            {{ campaign.template?.name || '-' }}
          </p>
        </UCard>
        <UCard>
          <p class="text-dimmed text-xs">
            Targets
          </p>
          <p class="mt-1 font-medium">
            {{ campaign.targets?.length || 0 }}
          </p>
        </UCard>
        <UCard>
          <p class="text-dimmed text-xs">
            Created by
          </p>
          <p class="mt-1 font-medium">
            {{ campaign.createdBy?.name || '-' }}
          </p>
        </UCard>
      </div>

      <!-- Target List -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-crosshair" class="size-4" />
            <span class="font-medium">Campaign Targets</span>
          </div>
        </template>

        <div v-if="!campaign.targets?.length" class="text-dimmed text-sm">
          No targets assigned.
        </div>

        <div v-else class="divide-accented divide-y">
          <div
            v-for="ct in campaign.targets" :key="ct.id" class="
              flex items-center justify-between py-3
              first:pt-0
              last:pb-0
            "
          >
            <div>
              <p class="font-medium">
                {{ ct.target?.firstName }} {{ ct.target?.lastName }}
              </p>
              <p class="text-dimmed text-sm">
                {{ ct.target?.email }}
              </p>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <UBadge v-if="ct.sentAt" color="success" variant="subtle" size="xs">
                Sent
              </UBadge>
              <UBadge v-else-if="ct.personalizedContent" color="primary" variant="subtle" size="xs">
                Personalized
              </UBadge>
              <UBadge v-else color="neutral" variant="subtle" size="xs">
                Pending
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Stats (when campaign is active or completed) -->
      <div
        v-if="stats && campaign.status !== 'draft'" class="
          mt-6 grid grid-cols-2 gap-4
          md:grid-cols-3
          lg:grid-cols-6
        "
      >
        <UCard>
          <p class="text-dimmed text-xs">
            Sent
          </p>
          <p class="mt-1 text-2xl font-bold">
            {{ stats.sent }}<span
              class="text-dimmed text-sm"
            >/{{ stats.total }}</span>
          </p>
        </UCard>
        <UCard>
          <p class="text-dimmed text-xs">
            Opened
          </p>
          <p class="mt-1 text-2xl font-bold">
            {{ stats.opened }}
          </p>
          <p v-if="stats.sent" class="text-dimmed text-xs">
            {{ Math.round(stats.opened / stats.sent * 100) }}%
          </p>
        </UCard>
        <UCard>
          <p class="text-dimmed text-xs">
            Clicked
          </p>
          <p class="mt-1 text-2xl font-bold">
            {{ stats.clicked }}
          </p>
          <p v-if="stats.sent" class="text-dimmed text-xs">
            {{ Math.round(stats.clicked / stats.sent * 100) }}%
          </p>
        </UCard>
        <UCard>
          <p class="text-dimmed text-xs">
            Submitted
          </p>
          <p class="text-error mt-1 text-2xl font-bold">
            {{ stats.submitted }}
          </p>
          <p v-if="stats.sent" class="text-dimmed text-xs">
            {{ Math.round(stats.submitted / stats.sent * 100) }}%
          </p>
        </UCard>
        <UCard>
          <p class="text-dimmed text-xs">
            Payload Exec
          </p>
          <p class="text-error mt-1 text-2xl font-bold">
            {{ stats.executed }}
          </p>
          <p v-if="stats.sent" class="text-dimmed text-xs">
            {{ Math.round(stats.executed / stats.sent * 100) }}%
          </p>
        </UCard>
        <UCard>
          <p class="text-dimmed text-xs">
            CTR
          </p>
          <p class="mt-1 text-2xl font-bold">
            {{ stats.sent ? Math.round(stats.clicked / stats.sent * 100) : 0 }}%
          </p>
        </UCard>
      </div>

      <!-- Interaction Timeline -->
      <UCard
        v-if="interactions?.length && campaign.status !== 'draft'" class="mt-6"
      >
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-activity" class="size-4" />
            <span class="font-medium">Interaction Log</span>
            <UBadge color="neutral" variant="subtle" size="xs">
              Live
            </UBadge>
          </div>
        </template>

        <div class="flex max-h-96 flex-col gap-2 overflow-y-auto">
          <template v-for="ct in interactions" :key="ct.id">
            <div
              v-for="interaction in ct.interactions"
              :key="interaction.id"
              class="
                hover:bg-accented
                flex items-center gap-3 rounded-md p-2 text-sm
              "
              :class="interaction.metadata ? 'cursor-pointer' : ''"
              @click="interaction.metadata ? openDetail(interaction, ct.target) : null"
            >
              <UIcon
                :name="eventIcons[interaction.eventType] || 'i-lucide-circle'"
                :class="`
                  text-${eventColors[interaction.eventType] || 'neutral'}
                `"
                class="size-4 shrink-0"
              />
              <div class="min-w-0 flex-1">
                <span class="font-medium">{{ ct.target?.firstName }} {{ ct.target?.lastName }}</span>
                <span class="text-dimmed"> — </span>
                <span class="capitalize">{{ interaction.eventType.replace(/_/g, ' ') }}</span>
              </div>
              <div class="flex items-center gap-2">
                <UIcon
                  v-if="interaction.metadata" name="i-lucide-chevron-right" class="
                    text-dimmed size-3
                  "
                />
                <span class="text-dimmed shrink-0 text-xs">
                  {{ formatDateTime(interaction.createdAt) }}
                </span>
              </div>
            </div>
          </template>

          <div
            v-if="!interactions.flatMap(ct => ct.interactions || []).length" class="
              text-dimmed py-4 text-center text-sm
            "
          >
            No interactions recorded yet. Waiting for targets to engage...
          </div>
        </div>
      </UCard>
    </div>

    <!-- Interaction Detail Modal -->
    <UModal v-model:open="showDetail" title="Interaction Details">
      <template #body>
        <div v-if="detailInteraction" class="flex flex-col gap-3 text-sm">
          <div>
            <p class="text-dimmed">
              Target
            </p>
            <p class="font-medium">
              {{ detailTarget?.firstName }} {{ detailTarget?.lastName }} ({{ detailTarget?.email }})
            </p>
          </div>
          <div>
            <p class="text-dimmed">
              Event
            </p>
            <p class="font-medium capitalize">
              {{ String(detailInteraction.eventType).replace(/_/g, ' ') }}
            </p>
          </div>
          <div>
            <p class="text-dimmed">
              Time
            </p>
            <p>{{ formatDateTime(detailInteraction.createdAt as string) }}</p>
          </div>

          <!-- Metadata -->
          <template v-if="detailInteraction.metadata">
            <USeparator />
            <div v-if="(detailInteraction.metadata as Record<string, unknown>).ip">
              <p class="text-dimmed">
                IP Address
              </p>
              <p class="font-mono">
                {{ (detailInteraction.metadata as Record<string, unknown>).ip }}
              </p>
            </div>
            <div v-if="(detailInteraction.metadata as Record<string, unknown>).userAgent">
              <p class="text-dimmed">
                User Agent
              </p>
              <p class="text-xs break-all">
                {{ (detailInteraction.metadata as Record<string, unknown>).userAgent }}
              </p>
            </div>
            <div v-if="(detailInteraction.metadata as Record<string, unknown>).url">
              <p class="text-dimmed">
                URL Clicked
              </p>
              <p class="text-primary break-all">
                {{ (detailInteraction.metadata as Record<string, unknown>).url }}
              </p>
            </div>

            <!-- Submitted credentials -->
            <div v-if="(detailInteraction.metadata as Record<string, unknown>).fields">
              <p class="text-dimmed mb-2">
                Submitted Data
              </p>
              <div class="border-error/30 bg-error/5 rounded-md border p-3">
                <div
                  v-for="(value, key) in ((detailInteraction.metadata as Record<string, unknown>).fields as Record<string, string>)"
                  :key="String(key)"
                  class="flex items-center justify-between py-1"
                >
                  <span class="text-dimmed font-medium">{{ key }}</span>
                  <span class="text-error font-mono">{{ value }}</span>
                </div>
              </div>
            </div>

            <!-- Payload info -->
            <div v-if="(detailInteraction.metadata as Record<string, unknown>).os">
              <p class="text-dimmed">
                OS
              </p>
              <p>{{ (detailInteraction.metadata as Record<string, unknown>).os }}</p>
            </div>
            <div v-if="(detailInteraction.metadata as Record<string, unknown>).hostname">
              <p class="text-dimmed">
                Hostname
              </p>
              <p class="font-mono">
                {{ (detailInteraction.metadata as Record<string, unknown>).hostname }}
              </p>
            </div>

          </template>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <UButton label="Close" color="neutral" variant="outline" @click="() => { showDetail = false }" />
        </div>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
