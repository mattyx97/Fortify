import { logInteraction } from '#server/services/interactions'
import { z } from 'zod'

const paramsSchema = z.object({ campaignTargetId: z.string().uuid() })

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export default defineZodEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params } }) {
    logInteraction({
      campaignTargetId: params.campaignTargetId,
      eventType: 'email_opened',
      metadata: {
        event: 'email_opened',
        ip: getRequestIP(event) || undefined,
        userAgent: getHeader(event, 'user-agent') || undefined,
      },
    }).catch(() => {})

    setResponseHeader(event, 'content-type', 'image/gif')
    setResponseHeader(event, 'cache-control', 'no-store')
    return PIXEL
  },
})
