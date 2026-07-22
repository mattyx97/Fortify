import { createCampaign } from '#server/services/campaigns'
import { getOrgMembership } from '#server/services/organizations'
import { createTargetAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid() })
const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  templateId: z.string().uuid(),
  channel: z.enum(['email', 'sms']),
  targetIds: z.array(z.string().uuid()).min(1),
})

export type TCreateCampaignBody = z.infer<typeof bodySchema>

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, createTargetAbility, { membership })
    return createCampaign({ orgId: params.orgId, ...body, createdById: user.id })
  },
})
