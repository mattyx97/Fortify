import type { AttachmentConfig, LandingPageConfig } from '#server/lib/database/schema/campaign'
import { injectPdfPayload } from './pdf-payload'

interface AssembleResult {
  subject: string
  html: string
  attachments?: { filename: string, content: Buffer, contentType: string }[]
}

/**
 * Assembles the final email/SMS with tracking pixel, wrapped links, and optional PDF attachment.
 * The AI-generated content is enriched with tracking mechanics.
 */
export async function assembleEmail(params: {
  subject: string
  content: string
  linkText: string
  campaignTargetId: string
  baseUrl: string
  channel: 'email' | 'sms'
  landingPageConfig?: LandingPageConfig | null
  attachmentConfig?: AttachmentConfig | null
  basePdfBytes?: Buffer | null
}): Promise<AssembleResult> {
  const trackPixelUrl = `${params.baseUrl}/api/track/pixel/${params.campaignTargetId}`

  let html = params.content

  // Insert CTA link ONLY if the template has a landing page configured
  if (params.linkText && params.landingPageConfig) {
    const landingPageUrl = `${params.baseUrl}/lp/${params.campaignTargetId}`
    const trackClickUrl = `${params.baseUrl}/api/track/click/${params.campaignTargetId}?url=${encodeURIComponent(landingPageUrl)}`

    if (params.channel === 'sms') {
      // SMS: append plain text with URL so it survives HTML stripping
      html += ` ${params.linkText}: ${trackClickUrl}`
    }
    else {
      html += `\n<p><a href="${trackClickUrl}" style="color: #1a73e8; text-decoration: underline;">${params.linkText}</a></p>`
    }
  }

  // Insert tracking pixel (email only)
  if (params.channel === 'email') {
    html += `\n<img src="${trackPixelUrl}" width="1" height="1" style="display:none;" />`
  }

  // Generate PDF attachment if configured
  const attachments: AssembleResult['attachments'] = []
  if (params.basePdfBytes && params.attachmentConfig) {
    const callbackUrl = `${params.baseUrl}/api/track/attachment/${params.campaignTargetId}`
    const injectedPdf = await injectPdfPayload({
      pdfBytes: params.basePdfBytes,
      callbackUrl,
    })
    attachments.push({
      filename: params.attachmentConfig.fileName,
      content: injectedPdf,
      contentType: 'application/pdf',
    })
  }

  return {
    subject: params.subject,
    html,
    attachments: attachments.length ? attachments : undefined,
  }
}
