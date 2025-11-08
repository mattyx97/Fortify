import { db } from '../../../utils/db'
import { auth } from '../../../utils/auth'
import { employeeTarget, user, socialProfile, scrapingHistory } from '../../../db/schema'
import { eq, and, desc } from 'drizzle-orm'

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

    // Validazione parametro
    const targetId = getRouterParam(event, 'targetId')
    if (!targetId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Target ID mancante'
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

    // Verifica esistenza target
    const target = await db.select().from(employeeTarget).where(eq(employeeTarget.id, targetId)).limit(1)
    if (!target.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Target non trovato'
      })
    }

    // Controllo permessi (multi-tenant)
    const isAdmin = currentUser[0].role === 'admin'
    const isOwnOrg = currentUser[0].organizationId === target[0].organizationId

    if (!isAdmin && !isOwnOrg) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accesso negato: puoi visualizzare solo lo storico dei target della tua organizzazione'
      })
    }

    // Query parameters
    const query = getQuery(event)
    const platform = query.platform || 'linkedin'
    const limit = query.limit ? parseInt(query.limit as string) : 10

    // Recupera social profile
    const profile = await db.select()
      .from(socialProfile)
      .where(and(
        eq(socialProfile.targetId, targetId),
        eq(socialProfile.platform, platform as string)
      ))
      .limit(1)

    if (!profile.length) {
      return {
        success: true,
        history: []
      }
    }

    // Recupera storico
    const history = await db.select({
      id: scrapingHistory.id,
      version: scrapingHistory.version,
      scrapedAt: scrapingHistory.scrapedAt,
      rawData: scrapingHistory.rawData,
    })
    .from(scrapingHistory)
    .where(eq(scrapingHistory.socialProfileId, profile[0].id))
    .orderBy(desc(scrapingHistory.version))
    .limit(limit)

    return {
      success: true,
      history
    }

  } catch (error) {
    console.error('Errore recupero storico scraping:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Errore interno del server'
    })
  }
})

