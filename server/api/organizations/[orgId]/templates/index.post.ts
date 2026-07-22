import { createTemplate } from '#server/services/campaigns'
import { getOrgMembership } from '#server/services/organizations'
import { createTargetAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid() })
const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  channel: z.enum(['email', 'sms']),
  subject: z.string().optional(),
  content: z.string().min(1),
  landingPageConfig: z.object({
    title: z.string(),
    brandLogo: z.string().optional(),
    brandColor: z.string().optional(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(['text', 'email', 'password']),
      label: z.string(),
      placeholder: z.string().optional(),
    })),
    submitLabel: z.string(),
    redirectUrl: z.string().optional(),
  }).optional(),
  attachmentConfig: z.object({
    fileName: z.string(),
    fileType: z.string(),
  }).optional(),
})

export type TCreateTemplateBody = z.infer<typeof bodySchema>

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, createTargetAbility, { membership })
    return createTemplate({ orgId: params.orgId, ...body, createdById: user.id })
  },
})
