import { getOrgMembership } from '#server/services/organizations'
import { addSocialProfile, getTarget } from '#server/services/targets'
import { manageProfilesAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), targetId: z.string().uuid() })
const bodySchema = z.object({
  platform: z.enum(['linkedin', 'github', 'twitter', 'facebook', 'instagram']),
  profileUrl: z.string().url(),
})

export type TAddProfileBody = z.infer<typeof bodySchema>

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, manageProfilesAbility, { membership })
    // Verify target belongs to this org
    await getTarget({ targetId: params.targetId, orgId: params.orgId })
    return addSocialProfile({ targetId: params.targetId, ...body })
  },
})
