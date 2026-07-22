import type { AttachmentConfig, LandingPageConfig } from '#server/lib/database/schema/campaign'
import type { ScrapingData } from '#server/lib/database/schema/target'
import type { SiteProfileExtractResult } from '#server/services/site-profile-extract'
import { schema } from '#server/lib/database/schema'
import { getCampaign } from '#server/services/campaigns'
import { assembleEmail } from '#server/services/email-assembly'
import { personalizeForTarget } from '#server/services/personalization'
import { eq } from 'drizzle-orm'

export default defineTask({
  meta: {
    name: 'campaign:launch',
    description: 'Processes campaign targets: AI personalization, email assembly, and sending',
  },
  async run({ payload }) {
    const { campaignId, orgId, baseUrl } = payload as { campaignId: string, orgId: string, baseUrl: string }
    const logger = useLogger()
    const db = useDatabase()
    const mailer = useMailer()

    const campaign = await getCampaign({ campaignId, orgId })
    const template = campaign.template
    if (!template) {
      logger.error(`[campaign:launch] Campaign ${campaignId} has no template`)
      return { result: { sent: 0, failed: 0 } }
    }

    // Fetch base PDF if attachment is configured
    let basePdfBytes: Buffer | null = null
    const attachmentConfig = template.attachmentConfig as AttachmentConfig | null
    if (attachmentConfig?.storagePath) {
      const disk = useDrive().use()
      const bytes = await disk.getBytes(attachmentConfig.storagePath)
      basePdfBytes = Buffer.from(bytes)
    }

    const landingPageConfig = template.landingPageConfig as LandingPageConfig | null
    const org = await db.query.organization.findFirst({ where: { id: orgId } })

    const tmpl: NonNullable<typeof template> = template

    async function processTarget(ct: typeof campaign.targets[number]) {
      const target = ct.target
      if (!target)
        return

      // Fetch OSINT data for this target
      const profiles = await db.query.employeeSocialProfile.findMany({
        where: { targetId: target.id },
        with: { scrapingResults: { orderBy: { scrapedAt: 'desc' }, limit: 1 } },
      })

      const scrapingData: ScrapingData[] = profiles
        .flatMap(p => p.scrapingResults)
        .map(r => r.data)
        .filter(Boolean)

      if (target.websiteProfileData) {
        scrapingData.push({
          platform: 'website',
          data: target.websiteProfileData as SiteProfileExtractResult,
        })
      }

      // AI personalization
      logger.info(`[campaign:launch] Personalizing for ${target.firstName} ${target.lastName}`)
      const personalized = await personalizeForTarget({
        templateName: tmpl.name,
        templateContent: tmpl.content,
        channel: campaign.channel as 'email' | 'sms',
        hasLandingPage: !!landingPageConfig,
        target: {
          firstName: target.firstName,
          lastName: target.lastName,
          email: target.email,
          jobTitle: target.jobTitle,
          department: target.department,
        },
        orgName: org?.name || 'Unknown',
        scrapingData,
      })

      // Save personalized content
      await db.update(schema.campaignTarget).set({
        personalizedSubject: personalized.subject,
        personalizedContent: personalized.content,
      }).where(eq(schema.campaignTarget.id, ct.id))

      // Assemble final email with tracking
      const assembled = await assembleEmail({
        subject: personalized.subject || tmpl.subject || campaign.name,
        content: personalized.content,
        linkText: personalized.linkText,
        campaignTargetId: ct.id,
        baseUrl,
        channel: campaign.channel as 'email' | 'sms',
        landingPageConfig,
        attachmentConfig,
        basePdfBytes,
      })

      // Send
      if (campaign.channel === 'email') {
        await mailer.sendRaw({
          to: target.email,
          subject: assembled.subject,
          html: assembled.html,
          attachments: assembled.attachments,
        })
      }
      else if (campaign.channel === 'sms') {
        // Strip HTML tags for plain SMS text (also drops the tracking pixel; the click
        // link was appended as plain text by assembleEmail and survives).
        // eslint-disable-next-line e18e/prefer-static-regex
        const smsBody = assembled.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

        if (target.phoneNumber && isBulkGateConfigured()) {
          logger.info(`[campaign:launch] Sending SMS via BulkGate to ${target.firstName} ${target.lastName} <${target.phoneNumber}>`)
          const smsRes = await useBulkGate().sendSms({ to: target.phoneNumber, text: smsBody })
          logger.info(`[campaign:launch] SMS ${smsRes.status} (id ${smsRes.smsId})`)
        }
        else {
          // BulkGate not configured (or target has no phone): fall back to a console simulation.
          const phone = target.phoneNumber || '<missing>'
          const divider = '─'.repeat(50)
          console.log(`\n${divider}\n📱 SMS SIMULATION (BulkGate not configured)\n${divider}\nTO:   ${target.firstName} ${target.lastName} <${phone}>\nFROM: ${campaign.name}\n${divider}\n${smsBody}\n${divider}\n`)
        }
      }

      // Mark as sent
      await db.update(schema.campaignTarget).set({
        sentAt: new Date(),
      }).where(eq(schema.campaignTarget.id, ct.id))

      logger.info(`[campaign:launch] Sent to ${target.email}`)
    }

    const results = await Promise.allSettled(campaign.targets.map(processTarget))

    let sent = 0
    let failed = 0
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        sent++
      }
      else {
        failed++
        logger.error(`[campaign:launch] Failed for ${campaign.targets[i]?.target?.email}`, r.reason)
      }
    })

    logger.info(`[campaign:launch] Campaign ${campaignId} done: ${sent} sent, ${failed} failed`)
    return { result: { sent, failed } }
  },
})
