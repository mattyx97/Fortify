<script setup lang="ts">
import type { AttachmentConfig, LandingPageConfig } from '#server/lib/database/schema/campaign'
import { useQueryClient } from '@tanstack/vue-query'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const toast = useToast()
const queryClient = useQueryClient()
const orgId = computed(() => route.params.orgId as string)

const { data: templates, isPending } = useTemplatesQuery(orgId)
const { createTemplate, deleteTemplate } = useTemplateMutations()
const editSaving = ref(false)

const channelIcons: Record<string, string> = {
  email: 'i-lucide-mail',
  sms: 'i-lucide-message-square',
}

const channelColors: Record<string, 'primary' | 'success'> = {
  email: 'primary',
  sms: 'success',
}

// ===== FORM STATE (shared for create + edit) =====

interface TemplateForm {
  name: string
  description: string
  channel: 'email' | 'sms'
  subject: string
  content: string
  enableLandingPage: boolean
  landingPage: {
    title: string
    brandColor: string
    fields: { name: string, type: 'text' | 'email' | 'password', label: string, placeholder: string }[]
    submitLabel: string
    redirectUrl: string
  }
  enableAttachment: boolean
  attachment: {
    fileName: string
    fileType: string
    file: File | null
    hasExisting: boolean
  }
}

const showFormModal = ref(false)
const editingTemplateId = ref<string | null>(null)
const isEditing = computed(() => editingTemplateId.value !== null)

function defaultForm(): TemplateForm {
  return {
    name: '',
    description: '',
    channel: 'email',
    subject: '',
    content: '',
    enableLandingPage: false,
    landingPage: {
      title: '',
      brandColor: '#1a73e8',
      fields: [{ name: 'email', type: 'email', label: 'Email', placeholder: '' }],
      submitLabel: 'Submit',
      redirectUrl: '',
    },
    enableAttachment: false,
    attachment: {
      fileName: '',
      fileType: 'application/pdf',
      file: null,
      hasExisting: false,
    },
  }
}

const form = ref<TemplateForm>(defaultForm())

function openCreate() {
  editingTemplateId.value = null
  form.value = defaultForm()
  showFormModal.value = true
}

function openEdit(template: Record<string, unknown>) {
  editingTemplateId.value = template.id as string
  const lp = template.landingPageConfig as LandingPageConfig | null
  const att = template.attachmentConfig as AttachmentConfig | null

  form.value = {
    name: template.name as string,
    description: (template.description as string) || '',
    channel: template.channel as 'email' | 'sms',
    subject: (template.subject as string) || '',
    content: template.content as string,
    enableLandingPage: !!lp,
    landingPage: lp
      ? {
          title: lp.title,
          brandColor: lp.brandColor || '#1a73e8',
          fields: lp.fields.map(f => ({ ...f, placeholder: f.placeholder || '' })),
          submitLabel: lp.submitLabel,
          redirectUrl: lp.redirectUrl || '',
        }
      : defaultForm().landingPage,
    enableAttachment: !!att,
    attachment: att
      ? { fileName: att.fileName, fileType: att.fileType, file: null, hasExisting: !!att.storagePath }
      : defaultForm().attachment,
  }
  showFormModal.value = true
}

function buildBody() {
  const landingPageConfig: LandingPageConfig | undefined = form.value.enableLandingPage
    ? {
        title: form.value.landingPage.title,
        brandColor: form.value.landingPage.brandColor || undefined,
        fields: form.value.landingPage.fields,
        submitLabel: form.value.landingPage.submitLabel,
        redirectUrl: form.value.landingPage.redirectUrl || undefined,
      }
    : undefined

  const attachmentConfig: AttachmentConfig | undefined = form.value.enableAttachment
    ? { fileName: form.value.attachment.fileName, fileType: form.value.attachment.fileType }
    : undefined

  return {
    name: form.value.name,
    description: form.value.description || undefined,
    channel: form.value.channel,
    subject: form.value.subject || undefined,
    content: form.value.content,
    landingPageConfig,
    attachmentConfig,
  }
}

async function handleSubmit() {
  if (!form.value.name || !form.value.content)
    return

  editSaving.value = true
  try {
    let templateId = editingTemplateId.value

    if (isEditing.value) {
      const base = buildBody()
      await $fetch(`/api/organizations/${orgId.value}/templates/${templateId}`, {
        method: 'PATCH',
        // Send `null` (not `undefined`) for disabled sections so the PATCH actually
        // clears them — `undefined` is stripped from JSON and keeps the old value.
        body: {
          ...base,
          landingPageConfig: form.value.enableLandingPage ? base.landingPageConfig : null,
          attachmentConfig: form.value.enableAttachment ? base.attachmentConfig : null,
          subject: form.value.subject || '',
          description: form.value.description || '',
        },
      })
    }
    else {
      const created = await createTemplate.mutateAsync({ orgId: orgId.value, body: buildBody() })
      templateId = (created as { id: string }).id
    }

    // Upload PDF if a new file was selected
    if (form.value.enableAttachment && form.value.attachment.file && templateId) {
      const formData = new FormData()
      formData.append('file', form.value.attachment.file)
      await $fetch(`/api/organizations/${orgId.value}/templates/${templateId}/attachment`, {
        method: 'POST',
        body: formData,
      })
    }

    await queryClient.invalidateQueries({ queryKey: ['organizations', orgId.value, 'templates'] })
    toast.add({ title: isEditing.value ? 'Template updated' : 'Template created', color: 'success', icon: 'i-lucide-check' })
    showFormModal.value = false
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to save template', color: 'error', icon: 'i-lucide-circle-x' })
  }
  finally {
    editSaving.value = false
  }
}

async function handleDelete(templateId: string) {
  try {
    await deleteTemplate.mutateAsync({ orgId: orgId.value, templateId })
    toast.add({ title: 'Template deleted', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message || 'Failed to delete', color: 'error', icon: 'i-lucide-circle-x' })
  }
}

// ===== LANDING PAGE FIELDS =====

function addField() {
  form.value.landingPage.fields.push({ name: '', type: 'text', label: '', placeholder: '' })
}

function removeField(index: number) {
  form.value.landingPage.fields.splice(index, 1)
}

// ===== HINTS =====

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    form.value.attachment.file = file
    if (!form.value.attachment.fileName) {
      form.value.attachment.fileName = file.name
    }
  }
}

function insertHint(hint: string) {
  form.value.content += ` \{\{${hint}\}\}`
}

function hintLabel(hint: string) {
  return `\{\{${hint}\}\}`
}

// ===== TABS =====
const formTabs: { label: string, icon: string, slot: 'content' | 'landing' | 'attachment' }[] = [
  { label: 'Content', icon: 'i-lucide-file-text', slot: 'content' },
  { label: 'Landing Page', icon: 'i-lucide-layout', slot: 'landing' },
  { label: 'Attachment', icon: 'i-lucide-paperclip', slot: 'attachment' },
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Templates" />
    </template>

    <div class="p-6">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          Templates
        </h2>
        <UButton icon="i-lucide-plus" label="New Template" @click="openCreate" />
      </div>

      <div v-if="isPending" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin" />
      </div>

      <div v-else-if="!templates?.length" class="py-12 text-center">
        <UIcon
          name="i-lucide-file-text" class="text-dimmed mx-auto mb-4 size-12"
        />
        <p class="text-lg font-medium">
          No templates yet
        </p>
        <p class="text-dimmed mt-1">
          Templates are created automatically when you create an organization.
        </p>
      </div>

      <div
        v-else class="
          grid gap-4
          sm:grid-cols-2
          lg:grid-cols-3
        "
      >
        <UCard
          v-for="template in templates"
          :key="template.id"
          class="
            hover:ring-primary
            cursor-pointer transition-all
            hover:ring-1
          "
          @click="openEdit(template as Record<string, unknown>)"
        >
          <div class="flex items-start justify-between">
            <div class="min-w-0 flex-1">
              <div class="mb-1 flex items-center gap-2">
                <UIcon
                  :name="channelIcons[template.channel] || 'i-lucide-file'" class="
                    size-4 shrink-0
                  "
                />
                <p class="text-highlighted truncate font-semibold">
                  {{ template.name }}
                </p>
              </div>
              <p
                v-if="template.description" class="
                  text-dimmed mt-1 line-clamp-2 text-sm
                "
              >
                {{ template.description }}
              </p>
              <div class="mt-2 flex items-center gap-2">
                <UBadge
                  :color="channelColors[template.channel] || 'neutral'" variant="subtle" size="xs" class="
                    capitalize
                  "
                >
                  {{ template.channel }}
                </UBadge>
                <UBadge v-if="template.landingPageConfig" color="neutral" variant="subtle" size="xs">
                  Landing page
                </UBadge>
                <UBadge
                  v-if="template.attachmentConfig" color="neutral" variant="subtle" size="xs"
                >
                  Attachment
                </UBadge>
              </div>
            </div>
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click.stop="handleDelete(template.id)" />
          </div>
        </UCard>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <UModal v-model:open="showFormModal" :title="isEditing ? 'Edit Template' : 'New Template'">
      <template #body>
        <div class="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <!-- Basic info -->
          <UFormField label="Name" required>
            <UInput
              v-model="form.name" placeholder="Password Reset" class="w-full"
            />
          </UFormField>
          <UFormField label="Description">
            <UInput
              v-model="form.description" placeholder="Simulates a password reset request..." class="
                w-full
              "
            />
          </UFormField>
          <UFormField label="Channel" required>
            <USelect
              v-model="form.channel"
              :items="[{ label: 'Email', value: 'email' }, { label: 'SMS', value: 'sms' }]"
              class="w-full"
              :disabled="isEditing"
            />
          </UFormField>

          <USeparator />

          <!-- Tabs for content sections -->
          <UTabs :items="formTabs" class="w-full">
            <!-- Content Tab -->
            <template #content>
              <div class="mt-3 flex flex-col gap-3">
                <UFormField v-if="form.channel === 'email'" label="Subject">
                  <UInput v-model="form.subject" class="w-full" />
                </UFormField>
                <UFormField label="Body" required>
                  <UTextarea v-model="form.content" class="w-full" :rows="6" />
                </UFormField>
                <!-- Writing tips -->
                <div
                  class="
                    border-primary/30 bg-primary/5 rounded-md border p-3 text-xs
                  "
                >
                  <div class="mb-2 flex items-center gap-1.5">
                    <UIcon
                      name="i-lucide-lightbulb" class="text-primary size-3.5"
                    />
                    <p class="text-primary font-medium">
                      How <code>{{ '\{\{ ... \}\}' }}</code> works
                    </p>
                  </div>
                  <p class="text-dimmed mb-2">
                    Anything inside double curly braces is sent to the AI to fill in for each target. You can use it in two ways:
                  </p>
                  <ul class="text-dimmed mb-3 list-disc space-y-1 pl-4">
                    <li>
                      <span class="text-default font-medium">Field hints</span> — point at a known target field, e.g. <code>{{ '\{\{firstName\}\}' }}</code>, <code>{{ '\{\{company\}\}' }}</code>, <code>{{ '\{\{jobTitle\}\}' }}</code>. The AI replaces it with the real value.
                    </li>
                    <li>
                      <span class="text-default font-medium">Free-form instructions</span> — write what you want the AI to invent, in your own words. Example: <code>{{ '\{\{ invent a short backstory for the company asking for the quote, no extra detail \}\}' }}</code> or <code>{{ '\{\{ pick the skills that fit this scenario \}\}' }}</code>.
                    </li>
                  </ul>
                  <p class="text-dimmed mb-2">
                    Click a hint to insert a known field. You can mix hints and instructions freely in the same message.
                  </p>
                  <div class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="hint in ['firstName', 'lastName', 'company', 'jobTitle', 'department', 'headline', 'bio', 'skills', 'location']"
                      :key="hint"
                      color="neutral"
                      variant="subtle"
                      size="xs"
                      class="
                        hover:bg-primary/10
                        cursor-pointer
                      "
                      :label="hintLabel(hint)"
                      @click="insertHint(hint)"
                    />
                  </div>
                </div>
              </div>
            </template>

            <!-- Landing Page Tab -->
            <template #landing>
              <div class="mt-3 flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium">
                      Fake Landing Page
                    </p>
                    <p class="text-dimmed text-xs">
                      The page targets see after clicking the link
                    </p>
                  </div>
                  <UButton
                    :label="form.enableLandingPage ? 'Enabled' : 'Disabled'"
                    :color="form.enableLandingPage ? 'primary' : 'neutral'"
                    variant="soft"
                    size="xs"
                    @click="() => { form.enableLandingPage = !form.enableLandingPage }"
                  />
                </div>

                <template v-if="form.enableLandingPage">
                  <UFormField label="Page Title">
                    <UInput
                      v-model="form.landingPage.title" placeholder="Reset Password - Acme" class="
                        w-full
                      "
                    />
                  </UFormField>
                  <div class="grid grid-cols-2 gap-3">
                    <UFormField label="Brand Color">
                      <UInput
                        v-model="form.landingPage.brandColor" type="color" class="
                          w-full
                        "
                      />
                    </UFormField>
                    <UFormField label="Submit Button Text">
                      <UInput
                        v-model="form.landingPage.submitLabel" placeholder="Submit" class="
                          w-full
                        "
                      />
                    </UFormField>
                  </div>
                  <UFormField label="Redirect URL after submit">
                    <UInput
                      v-model="form.landingPage.redirectUrl" placeholder="https://company.com" class="
                        w-full
                      "
                    />
                  </UFormField>

                  <!-- Fields builder -->
                  <div class="flex items-center justify-between">
                    <p class="text-sm font-medium">
                      Form Fields
                    </p>
                    <UButton icon="i-lucide-plus" size="xs" variant="outline" label="Add Field" @click="addField" />
                  </div>
                  <div
                    v-for="(field, i) in form.landingPage.fields" :key="i" class="
                      flex items-end gap-2
                    "
                  >
                    <UFormField label="Label" class="flex-1">
                      <UInput
                        v-model="field.label" placeholder="Email" class="w-full"
                      />
                    </UFormField>
                    <UFormField label="Name" class="w-24">
                      <UInput
                        v-model="field.name" placeholder="email" class="w-full"
                      />
                    </UFormField>
                    <UFormField label="Type" class="w-28">
                      <USelect
                        v-model="field.type"
                        :items="[{ label: 'Text', value: 'text' }, { label: 'Email', value: 'email' }, { label: 'Password', value: 'password' }]"
                        class="w-full"
                      />
                    </UFormField>
                    <UButton
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      size="xs"
                      class="mb-1"
                      :disabled="form.landingPage.fields.length <= 1"
                      @click="removeField(i)"
                    />
                  </div>
                </template>
              </div>
            </template>

            <!-- Attachment Tab -->
            <template #attachment>
              <div
                v-if="form.channel !== 'email'" class="
                  text-dimmed mt-3 py-6 text-center text-sm
                "
              >
                Attachments are only available for email campaigns.
              </div>
              <div v-else class="mt-3 flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium">
                      Silver Payload Attachment
                    </p>
                    <p class="text-dimmed text-xs">
                      Attach a controlled payload to track file execution
                    </p>
                  </div>
                  <UButton
                    :label="form.enableAttachment ? 'Enabled' : 'Disabled'"
                    :color="form.enableAttachment ? 'primary' : 'neutral'"
                    variant="soft"
                    size="xs"
                    @click="() => { form.enableAttachment = !form.enableAttachment }"
                  />
                </div>

                <template v-if="form.enableAttachment">
                  <UFormField label="File Name">
                    <UInput
                      v-model="form.attachment.fileName" placeholder="report_Q1.pdf" class="
                        w-full
                      "
                    />
                  </UFormField>

                  <!-- PDF Upload -->
                  <div
                    v-if="form.attachment.hasExisting && !form.attachment.file" class="
                      border-success/30 bg-success/5 flex items-center
                      justify-between rounded-md border p-3
                    "
                  >
                    <div class="flex items-center gap-2">
                      <UIcon
                        name="i-lucide-file-check" class="text-success size-4"
                      />
                      <span class="text-sm">PDF uploaded</span>
                    </div>
                    <UButton size="xs" color="neutral" variant="outline" label="Replace" @click="($refs.fileInput as HTMLInputElement)?.click()" />
                  </div>
                  <div v-else>
                    <div
                      class="
                        border-dimmed
                        hover:border-primary
                        flex cursor-pointer flex-col items-center gap-2
                        rounded-md border-2 border-dashed p-6 transition-colors
                      "
                      @click="($refs.fileInput as HTMLInputElement)?.click()"
                    >
                      <UIcon name="i-lucide-upload" class="text-dimmed size-6" />
                      <p v-if="form.attachment.file" class="text-sm font-medium">
                        {{ form.attachment.file.name }}
                      </p>
                      <p v-else class="text-dimmed text-sm">
                        Click to select a PDF template
                      </p>
                    </div>
                  </div>
                  <input
                    ref="fileInput"
                    type="file"
                    accept=".pdf"
                    class="hidden"
                    @change="handleFileSelect"
                  >
                </template>
              </div>
            </template>
          </UTabs>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" @click="() => { showFormModal = false }" />
          <UButton :label="isEditing ? 'Save' : 'Create'" :loading="editSaving || createTemplate.isPending.value" @click="handleSubmit" />
        </div>
      </template>
    </UModal>
  </UDashboardPanel>
</template>
