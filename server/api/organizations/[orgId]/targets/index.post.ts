import { getOrgMembership } from '#server/services/organizations'
import { createTarget } from '#server/services/targets'
import { createTargetAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid() })
const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  websiteUrl: z.union([z.string().url(), z.literal('')]).optional(),
  profiles: z.array(z.object({
    platform: z.enum(['linkedin', 'github', 'twitter', 'facebook', 'instagram']),
    profileUrl: z.string().url(),
  })).optional(),
})

export type TCreateTargetBody = z.infer<typeof bodySchema>

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, createTargetAbility, { membership })
    return createTarget({ organizationId: params.orgId, ...body })
  },
})
