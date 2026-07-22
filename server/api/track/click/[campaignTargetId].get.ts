import { logInteraction } from '#server/services/interactions'
import { z } from 'zod'

const paramsSchema = z.object({ campaignTargetId: z.string().uuid() })
const querySchema = z.object({ url: z.string().url() })

export default defineZodEventHandler({
  input: { params: paramsSchema, query: querySchema },
  async handler(event, { input: { params, query } }) {
    logInteraction({
      campaignTargetId: params.campaignTargetId,
      eventType: 'link_clicked',
      metadata: {
        event: 'link_clicked',
        ip: getRequestIP(event) || undefined,
        userAgent: getHeader(event, 'user-agent') || undefined,
        url: query.url,
      },
    }).catch(() => {})

    return sendRedirect(event, query.url)
  },
})
