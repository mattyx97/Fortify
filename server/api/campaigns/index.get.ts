import { db } from '../../utils/db'
import { auth } from '../../utils/auth'
import { phishingCampaign, user, campaignTarget } from '../../db/schema'
import { eq, and, desc, count } from 'drizzle-orm'

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

    // Query parameters
    const query = getQuery(event)
    const status = query.status as string | undefined

    // Costruisci query base
    let campaignsQuery = db.select({
      id: phishingCampaign.id,
      nome: phishingCampaign.nome,
      descrizione: phishingCampaign.descrizione,
      status: phishingCampaign.status,
      campaignType: phishingCampaign.campaignType,
      organizationId: phishingCampaign.organizationId,
      createdById: phishingCampaign.createdById,
      createdAt: phishingCampaign.createdAt,
      launchedAt: phishingCampaign.launchedAt,
      completedAt: phishingCampaign.completedAt,
    })
    .from(phishingCampaign)

    // Filtro per organizzazione (multi-tenant)
    const isAdmin = currentUser[0].role === 'admin'
    
    if (isAdmin) {
      // Admin vede tutte le campagne
      if (status) {
        campaignsQuery = campaignsQuery.where(eq(phishingCampaign.status, status))
      }
    } else {
      // Altri vedono solo campagne della propria organizzazione
      const conditions = [eq(phishingCampaign.organizationId, currentUser[0].organizationId!)]
      if (status) {
        conditions.push(eq(phishingCampaign.status, status))
      }
      campaignsQuery = campaignsQuery.where(and(...conditions))
    }

    const campaigns = await campaignsQuery.orderBy(desc(phishingCampaign.createdAt))

    // Aggiungi statistiche per ogni campagna
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        // Conta target totali
        const totalTargets = await db.select({ count: count() })
          .from(campaignTarget)
          .where(eq(campaignTarget.campaignId, campaign.id))

        // Conta email inviate
        const sentCount = await db.select({ count: count() })
          .from(campaignTarget)
          .where(and(
            eq(campaignTarget.campaignId, campaign.id),
            // sentAt NOT NULL
          ))
          .then(result => result[0]?.count || 0)

        // Conta click
        const clickCount = await db.select({ count: count() })
          .from(campaignTarget)
          .where(and(
            eq(campaignTarget.campaignId, campaign.id),
            // clickedAt NOT NULL
          ))
          .then(result => result[0]?.count || 0)

        // Conta submission
        const submitCount = await db.select({ count: count() })
          .from(campaignTarget)
          .where(and(
            eq(campaignTarget.campaignId, campaign.id),
            // submittedAt NOT NULL
          ))
          .then(result => result[0]?.count || 0)

        return {
          ...campaign,
          stats: {
            totalTargets: totalTargets[0]?.count || 0,
            sentCount,
            clickCount,
            submitCount,
            clickRate: totalTargets[0]?.count ? ((clickCount / totalTargets[0].count) * 100).toFixed(1) : '0',
            submitRate: clickCount ? ((submitCount / clickCount) * 100).toFixed(1) : '0',
          }
        }
      })
    )

    return {
      success: true,
      campaigns: campaignsWithStats
    }

  } catch (error) {
    console.error('Errore recupero campagne:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

