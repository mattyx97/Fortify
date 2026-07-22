import { getOrgMembership } from '#server/services/organizations'
import { removeTarget } from '#server/services/targets'
import { deleteTargetAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), targetId: z.string().uuid() })

export default defineAuthEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, deleteTargetAbility, { membership })
    return removeTarget({ targetId: params.targetId, orgId: params.orgId })
  },
})
