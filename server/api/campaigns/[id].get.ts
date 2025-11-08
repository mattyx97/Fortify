import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { phishingCampaign, user, campaignTarget, employeeTarget, interactionLog } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'

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

    // Recupera campagna
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
        statusMessage: 'Accesso negato: puoi visualizzare solo le campagne della tua organizzazione'
      })
    }

    // Recupera target della campagna
    const targets = await db.select({
      id: campaignTarget.id,
      targetId: campaignTarget.targetId,
      targetName: employeeTarget.nome,
      targetEmail: employeeTarget.email,
      targetPosition: employeeTarget.posizione,
      personalizedMessage: campaignTarget.personalizedMessage,
      emailSubject: campaignTarget.emailSubject,
      sentAt: campaignTarget.sentAt,
      clickedAt: campaignTarget.clickedAt,
      submittedAt: campaignTarget.submittedAt,
      trackingUuid: campaignTarget.trackingUuid,
    })
    .from(campaignTarget)
    .innerJoin(employeeTarget, eq(campaignTarget.targetId, employeeTarget.id))
    .where(eq(campaignTarget.campaignId, id))
    .orderBy(desc(campaignTarget.createdAt))

    // Aggiungi interaction log per ogni target
    const targetsWithInteractions = await Promise.all(
      targets.map(async (target) => {
        const interactions = await db.select()
          .from(interactionLog)
          .where(eq(interactionLog.campaignTargetId, target.id))
          .orderBy(desc(interactionLog.timestamp))

        return {
          ...target,
          interactions
        }
      })
    )

    return {
      success: true,
      data: {
        ...campaign[0],
        targets: targetsWithInteractions
      }
    }

  } catch (error) {
    console.error('Errore recupero campagna:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

