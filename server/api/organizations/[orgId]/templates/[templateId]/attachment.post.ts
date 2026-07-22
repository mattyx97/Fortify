import { uploadTemplateAttachment } from '#server/services/campaigns'
import { getOrgMembership } from '#server/services/organizations'
import { createTargetAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), templateId: z.string().uuid() })
const bodySchema = z.object({
  file: z.file().mime(['application/pdf']).max(10 * 1024 * 1024),
})

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, createTargetAbility, { membership })
    return uploadTemplateAttachment({ templateId: params.templateId, orgId: params.orgId, file: body.file })
  },
})
