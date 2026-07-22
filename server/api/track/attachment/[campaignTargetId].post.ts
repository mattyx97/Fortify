import { logInteraction } from '#server/services/interactions'
import { z } from 'zod'

const paramsSchema = z.object({ campaignTargetId: z.string().uuid() })

export default defineZodEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params } }) {
    await logInteraction({
      campaignTargetId: params.campaignTargetId,
      eventType: 'payload_executed',
      metadata: {
        event: 'payload_executed',
        ip: getRequestIP(event) || undefined,
        userAgent: getHeader(event, 'user-agent') || undefined,
      },
    })

    return { ok: true }
  },
})
