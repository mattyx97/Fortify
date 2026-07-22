import { logInteraction } from '#server/services/interactions'
import { z } from 'zod'

const paramsSchema = z.object({ campaignTargetId: z.string().uuid() })

export default defineZodEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params } }) {
    const body = await readBody(event)

    await logInteraction({
      campaignTargetId: params.campaignTargetId,
      eventType: 'form_submitted',
      metadata: {
        event: 'form_submitted',
        ip: getRequestIP(event) || undefined,
        userAgent: getHeader(event, 'user-agent') || undefined,
        fields: body || {},
      },
    })

    return { ok: true }
  },
})
