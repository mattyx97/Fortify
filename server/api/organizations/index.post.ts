import { createOrganization } from '#server/services/organizations'
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1).max(255),
})

export type TCreateOrganizationBody = z.infer<typeof bodySchema>

export default defineAuthEventHandler({
  input: { body: bodySchema },
  async handler(_event, { input: { body }, identity: { user } }) {
    return createOrganization({ name: body.name, creatorUserId: user.id })
  },
})
