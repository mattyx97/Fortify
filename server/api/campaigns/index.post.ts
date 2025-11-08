import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { phishingCampaign, user, employeeTarget, campaignTarget, socialProfile, scrapingHistory } from '../../db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { generatePersonalizedMessage } from '../../utils/ai/nebius'
import type { ProfileData } from '../../utils/scraper/base'

export default defineEventHandler(async (event) => {
  try {
    // Autenticazione
    const session = await auth.api.getSession({ headers: event.headers })
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non autorizzato'
      })
    }

    // Ottieni utente corrente
    const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
    if (!currentUser.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Utente non trovato'
      })
    }

    // Verifica organizzazione
    if (!currentUser[0].organizationId && currentUser[0].role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Utente non associato a nessuna organizzazione'
      })
    }

    // Validazione input
    const body = await readBody(event)

    if (!body.nome || typeof body.nome !== 'string' || body.nome.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Nome campagna obbligatorio'
      })
    }

    if (!body.targetIds || !Array.isArray(body.targetIds) || body.targetIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Almeno un target deve essere specificato'
      })
    }

    const campaignType = body.campaignType || 'urgent_request'
    const validTypes = ['password_reset', 'invoice', 'executive_impersonation', 'urgent_request', 'training_invitation', 'security_alert']
    
    if (!validTypes.includes(campaignType)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tipo di campagna non valido'
      })
    }

    // Determina organizationId
    let campaignOrgId = currentUser[0].organizationId
    if (currentUser[0].role === 'admin' && body.organizationId) {
      campaignOrgId = body.organizationId
    }

    if (!campaignOrgId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Organization ID mancante'
      })
    }

    // Verifica che tutti i target esistano e appartengano all'organizzazione
    const targets = await db.select()
      .from(employeeTarget)
      .where(and(
        inArray(employeeTarget.id, body.targetIds),
        eq(employeeTarget.organizationId, campaignOrgId),
        eq(employeeTarget.isActive, true)
      ))

    if (targets.length !== body.targetIds.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Uno o più target non validi o non appartenenti all\'organizzazione'
      })
    }

    // Crea campagna
    const newCampaign = await db.insert(phishingCampaign).values({
      organizationId: campaignOrgId,
      nome: body.nome.trim(),
      descrizione: body.descrizione?.trim() || null,
      campaignType,
      status: 'draft',
      createdById: session.user.id,
    }).returning()

    // Genera messaggi personalizzati per ogni target usando AI
    const campaignTargets = await Promise.all(
      targets.map(async (target) => {
        try {
          // Recupera dati profilo più recenti
          const profiles = await db.select()
            .from(socialProfile)
            .where(and(
              eq(socialProfile.targetId, target.id),
              eq(socialProfile.platform, 'linkedin')
            ))
            .limit(1)

          let profileData: ProfileData | undefined

          if (profiles.length > 0) {
            const latestScraping = await db.select()
              .from(scrapingHistory)
              .where(eq(scrapingHistory.socialProfileId, profiles[0].id))
              .orderBy(desc(scrapingHistory.version))
              .limit(1)

            if (latestScraping.length > 0) {
              profileData = latestScraping[0].rawData as ProfileData
            }
          }

          // Genera messaggio con AI
          const aiResult = await generatePersonalizedMessage(
            profileData || {},
            campaignType as any,
            target.nome,
            target.posizione || undefined,
            undefined
          )

          // Crea campaign target
          const ct = await db.insert(campaignTarget).values({
            campaignId: newCampaign[0].id,
            targetId: target.id,
            personalizedMessage: aiResult.body || 'Messaggio non generato',
            emailSubject: aiResult.subject || 'Azione Richiesta',
          }).returning()

          return ct[0]
        } catch (error) {
          console.error(`Errore generazione messaggio per target ${target.id}:`, error)
          
          // Fallback a messaggio generico
          const ct = await db.insert(campaignTarget).values({
            campaignId: newCampaign[0].id,
            targetId: target.id,
            personalizedMessage: 'Messaggio di test phishing',
            emailSubject: 'Azione Richiesta',
          }).returning()

          return ct[0]
        }
      })
    )

    return {
      success: true,
      data: {
        campaign: newCampaign[0],
        targetsCount: campaignTargets.length
      }
    }

  } catch (error) {
    console.error('Errore creazione campagna:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

