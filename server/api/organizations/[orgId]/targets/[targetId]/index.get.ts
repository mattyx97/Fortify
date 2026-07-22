import { getOrgMembership } from '#server/services/organizations'
import { getTarget } from '#server/services/targets'
import { viewTargetAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.uuid(), targetId: z.string().uuid() })

export default defineAuthEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, viewTargetAbility, { membership })
    return getTarget({ targetId: params.targetId, orgId: params.orgId })
  },
})
