import { extractSiteProfile } from '#server/services/site-profile-extract'
import { z } from 'zod'

const bodySchema = z.object({
  url: z.string().url().max(2048),
})

export type TSiteProfileBody = z.infer<typeof bodySchema>

export default defineAuthEventHandler({
  input: { body: bodySchema },
  async handler(_event, { input: { body } }) {
    return extractSiteProfile({ url: body.url })
  },
})
