import { db } from '../../../utils/db'
import { auth } from '../../../utils/auth'
import { phishingCampaign, user, campaignTarget, interactionLog } from '../../../db/schema'
import { eq } from 'drizzle-orm'

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

    // Validazione parametro ID
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID campagna mancante'
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

    // Verifica esistenza campagna
    const campaign = await db.select().from(phishingCampaign).where(eq(phishingCampaign.id, id)).limit(1)
    if (!campaign.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Campagna non trovata'
      })
    }

    // Controllo permessi (multi-tenant)
    const isAdmin = currentUser[0].role === 'admin'
    const isOwnOrg = currentUser[0].organizationId === campaign[0].organizationId

    if (!isAdmin && !isOwnOrg) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accesso negato: puoi lanciare solo le campagne della tua organizzazione'
      })
    }

    // Verifica stato campagna
    if (campaign[0].status === 'launched') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Campagna già lanciata'
      })
    }

    if (campaign[0].status === 'completed') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Campagna già completata'
      })
    }

    // Recupera tutti i target della campagna
    const targets = await db.select()
      .from(campaignTarget)
      .where(eq(campaignTarget.campaignId, id))

    if (targets.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Nessun target configurato per questa campagna'
      })
    }

    // Segna tutti i target come "inviati" (simulazione)
    // In una implementazione reale, qui invieresti le email via SMTP/SendGrid
    const now = new Date()
    
    await Promise.all(
      targets.map(async (target) => {
        // Aggiorna sentAt
        await db.update(campaignTarget)
          .set({ sentAt: now })
          .where(eq(campaignTarget.id, target.id))

        // Crea interaction log
        await db.insert(interactionLog).values({
          campaignTargetId: target.id,
          type: 'email_sent',
          data: {
            sentAt: now.toISOString(),
            subject: target.emailSubject,
            trackingUuid: target.trackingUuid,
          },
          timestamp: now,
        })
      })
    )

    // Aggiorna stato campagna
    const updated = await db.update(phishingCampaign)
      .set({
        status: 'launched',
        launchedAt: now,
      })
      .where(eq(phishingCampaign.id, id))
      .returning()

    return {
      success: true,
      data: {
        campaign: updated[0],
        targetsSent: targets.length,
        message: `Campagna lanciata con successo. ${targets.length} email simulate inviate.`
      }
    }

  } catch (error) {
    console.error('Errore lancio campagna:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

