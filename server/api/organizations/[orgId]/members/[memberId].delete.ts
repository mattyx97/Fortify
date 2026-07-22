import { removeOrgMember } from '#server/services/members'
import { getOrgMembership } from '#server/services/organizations'
import { manageMembersAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), memberId: z.string().uuid() })

export default defineAuthEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, manageMembersAbility, { membership })
    return removeOrgMember({ memberId: params.memberId, orgId: params.orgId })
  },
})
