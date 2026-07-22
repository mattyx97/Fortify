import { getOrgMembership } from '#server/services/organizations'
import { updateTarget } from '#server/services/targets'
import { editTargetAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), targetId: z.string().uuid() })
const bodySchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.email().optional(),
  phoneNumber: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  websiteUrl: z.union([z.string().url(), z.literal('')]).optional().nullable(),
})

export type TUpdateTargetBody = z.infer<typeof bodySchema>

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, editTargetAbility, { membership })
    return updateTarget({ targetId: params.targetId, orgId: params.orgId, data: body })
  },
})
